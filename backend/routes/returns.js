const express = require('express');
const router = express.Router();
const db = require('../database');
const dayjs = require('dayjs');

router.get('/returns', (req, res) => {
  const { schedule_id, costume_id, keyword } = req.query;
  let records = db.getAll('return_records');

  if (schedule_id) {
    records = records.filter(r => r.schedule_id == schedule_id);
  }
  if (costume_id) {
    records = records.filter(r => r.costume_id == costume_id);
  }
  if (keyword) {
    const kw = keyword.toLowerCase();
    records = records.filter(r => 
      r.return_no.toLowerCase().includes(kw) ||
      r.costume_name.toLowerCase().includes(kw)
    );
  }

  records.sort((a, b) => new Date(b.return_date) - new Date(a.return_date));
  
  const result = records.map(r => {
    const items = db.filter('return_items', { return_id: r.id });
    return { ...r, items };
  });

  res.json(result);
});

router.get('/returns/:id', (req, res) => {
  const record = db.getById('return_records', req.params.id);
  if (!record) {
    return res.status(404).json({ error: '归还记录不存在' });
  }

  const items = db.filter('return_items', { return_id: record.id });
  const damages = db.filter('damage_records', { return_id: record.id });

  res.json({ ...record, items, damage_records: damages });
});

router.post('/returns/by-schedule/:scheduleId', (req, res) => {
  const { operator, remark, damaged_items } = req.body;
  const scheduleId = req.params.scheduleId;

  const schedule = db.getById('rental_schedules', scheduleId);
  if (!schedule) {
    return res.status(404).json({ error: '排期不存在' });
  }

  if (schedule.status !== 'outbound') {
    return res.status(400).json({ error: '该排期未出库，无法归还' });
  }

  const outbound = db.filter('outbound_records', { schedule_id: scheduleId })
    .sort((a, b) => b.id - a.id)[0];
  
  if (!outbound) {
    return res.status(400).json({ error: '未找到出库记录' });
  }

  const outboundItems = db.filter('outbound_items', { outbound_id: outbound.id });

  const returnNo = `RET-${dayjs().format('YYYYMMDD')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
  const nowStr = dayjs().format('YYYY-MM-DD HH:mm:ss');

  db.transaction(() => {
    const info = db.insert('return_records', {
      return_no: returnNo,
      schedule_id: parseInt(scheduleId),
      outbound_id: outbound.id,
      costume_id: schedule.costume_id,
      costume_name: schedule.costume_name,
      total_quantity: schedule.quantity,
      operator: operator || '系统',
      status: 'returned',
      remark: remark || null,
      return_date: nowStr
    });

    const returnId = info.lastInsertRowid;
    
    let totalDamaged = 0;
    const damagedItemMap = {};
    if (damaged_items && Array.isArray(damaged_items)) {
      damaged_items.forEach(item => {
        damagedItemMap[item.batch_id] = {
          damaged_quantity: parseInt(item.damaged_quantity) || 0,
          good_quantity: parseInt(item.good_quantity) || 0
        };
      });
    }

    const costume = db.getById('costumes', schedule.costume_id);

    outboundItems.forEach(outItem => {
      const batchInfo = damagedItemMap[outItem.batch_id] || { good_quantity: outItem.quantity, damaged_quantity: 0 };
      const damagedQty = batchInfo.damaged_quantity || 0;
      const goodQty = batchInfo.good_quantity !== undefined ? batchInfo.good_quantity : (outItem.quantity - damagedQty);
      
      if (goodQty + damagedQty !== outItem.quantity) {
        throw new Error(`批次 ${outItem.batch_no} 的完好件数(${goodQty}) + 破损件数(${damagedQty}) 必须等于出库数量(${outItem.quantity})`);
      }
      
      totalDamaged += damagedQty;

      db.insert('return_items', {
        return_id: returnId,
        batch_id: outItem.batch_id,
        batch_no: outItem.batch_no,
        quantity: outItem.quantity,
        good_quantity: goodQty,
        damaged_quantity: damagedQty
      });

      if (goodQty > 0) {
        const batchRecord = db.getById('costume_batches', outItem.batch_id);
        if (batchRecord) {
          db.update('costume_batches', outItem.batch_id, {
            available_quantity: batchRecord.available_quantity + goodQty
          });
        }
      }

      if (damagedQty > 0) {
        const damageNo = `DMG-${dayjs().format('YYYYMMDD')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
        const compensationAmount = (costume?.damage_deposit || 100) * damagedQty;

        db.insert('damage_records', {
          damage_no: damageNo,
          return_id: returnId,
          schedule_id: parseInt(scheduleId),
          costume_id: schedule.costume_id,
          costume_name: schedule.costume_name,
          batch_id: outItem.batch_id,
          batch_no: outItem.batch_no,
          damaged_quantity: damagedQty,
          damage_level: 'minor',
          compensation_amount: compensationAmount,
          damage_description: remark || '归还时发现破损',
          handler: operator || '系统',
          status: 'pending'
        });
      }
    });

    db.update('rental_schedules', scheduleId, { status: 'returned' });
  });

  const returnRecord = db.getAll('return_records').find(r => r.return_no === returnNo);
  const items = db.filter('return_items', { return_id: returnRecord.id });
  
  res.status(201).json({ ...returnRecord, items });
});

router.get('/damages', (req, res) => {
  const { status, costume_id, keyword } = req.query;
  let records = db.getAll('damage_records');

  if (status) {
    records = records.filter(r => r.status === status);
  }
  if (costume_id) {
    records = records.filter(r => r.costume_id == costume_id);
  }
  if (keyword) {
    const kw = keyword.toLowerCase();
    records = records.filter(r => 
      r.damage_no.toLowerCase().includes(kw) ||
      r.costume_name.toLowerCase().includes(kw)
    );
  }

  records.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(records);
});

router.get('/damages/:id', (req, res) => {
  const record = db.getById('damage_records', req.params.id);
  if (!record) {
    return res.status(404).json({ error: '破损记录不存在' });
  }
  res.json(record);
});

router.put('/damages/:id', (req, res) => {
  const { damage_level, compensation_amount, damage_description, handler, status } = req.body;

  const existing = db.getById('damage_records', req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '破损记录不存在' });
  }

  db.update('damage_records', req.params.id, {
    damage_level: damage_level || existing.damage_level,
    compensation_amount: compensation_amount !== undefined ? compensation_amount : existing.compensation_amount,
    damage_description: damage_description !== undefined ? damage_description : existing.damage_description,
    handler: handler !== undefined ? handler : existing.handler,
    status: status || existing.status
  });

  const record = db.getById('damage_records', req.params.id);
  res.json(record);
});

router.post('/damages/:id/resolve', (req, res) => {
  const { handler, remark } = req.body;

  const existing = db.getById('damage_records', req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '破损记录不存在' });
  }

  if (existing.status === 'resolved') {
    return res.status(400).json({ error: '该记录已处理' });
  }

  db.update('damage_records', req.params.id, {
    status: 'resolved',
    handler: handler || existing.handler || '管理员'
  });

  res.json({ message: '破损记录已处理' });
});

module.exports = router;
