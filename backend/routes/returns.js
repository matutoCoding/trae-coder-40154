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
    return res.status(404).json({ error: '记录不存在' });
  }

  const items = db.filter('return_items', { return_id: record.id });
  const itemWithBatch = items.map(item => {
    const batch = db.getById('costume_batches', item.batch_id);
    return {
      ...item,
      expiry_date: batch?.expiry_date
    };
  });

  const damages = db.filter('damage_records', { return_id: record.id });

  let scheduleInfo = null;
  if (record.schedule_id) {
    const s = db.getById('rental_schedules', record.schedule_id);
    if (s) {
      scheduleInfo = {
        id: s.id,
        schedule_no: s.schedule_no,
        troupe_name: s.troupe_name || '散客',
        start_date: s.start_date,
        end_date: s.end_date,
        contact_person: s.contact_person,
        phone: s.phone,
        status: s.status
      };
    }
  }

  let outboundInfo = null;
  if (record.outbound_id) {
    const out = db.getById('outbound_records', record.outbound_id);
    if (out) {
      outboundInfo = {
        id: out.id,
        outbound_no: out.outbound_no,
        outbound_date: out.outbound_date,
        operator: out.operator
      };
    }
  }

  res.json({ ...record, items: itemWithBatch, damages, schedule: scheduleInfo, outbound: outboundInfo });
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
  const { handler, remark, received_amount, payment_method } = req.body;

  const existing = db.getById('damage_records', req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '破损记录不存在' });
  }

  if (existing.status === 'resolved' || existing.status === 'waived') {
    return res.status(400).json({ error: '该记录已处理或已豁免' });
  }

  const receivable = existing.compensation_amount;
  const actualReceived = received_amount !== undefined ? parseFloat(received_amount) : receivable;
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

  let newStatus = 'resolved';
  let receivedRecord = {
    received_amount: actualReceived,
    payment_method: payment_method || '现金',
    handler: handler || existing.handler || '管理员',
    receive_time: now,
    remark: remark || ''
  };

  if (actualReceived < receivable) {
    newStatus = 'partial';
  }

  let paymentRecords = [];
  try {
    paymentRecords = typeof existing.payment_records === 'string' 
      ? JSON.parse(existing.payment_records) 
      : existing.payment_records || [];
  } catch (e) {
    paymentRecords = [];
  }
  paymentRecords.push(receivedRecord);

  const totalReceived = paymentRecords.reduce((sum, r) => sum + (parseFloat(r.received_amount) || 0), 0);
  let finalStatus = newStatus;
  if (totalReceived >= receivable) {
    finalStatus = 'resolved';
  }

  db.update('damage_records', req.params.id, {
    status: finalStatus,
    received_amount: totalReceived,
    remaining_amount: Math.max(0, receivable - totalReceived),
    resolved_time: finalStatus === 'resolved' ? now : existing.resolved_time,
    payment_records: JSON.stringify(paymentRecords),
    handler: handler || existing.handler || '管理员'
  });

  res.json({ 
    message: `收款成功，已收款 ¥${actualReceived.toFixed(2)}，状态：${finalStatus === 'resolved' ? '已处理完成' : '部分处理'}`,
    status: finalStatus,
    total_received: totalReceived,
    remaining_amount: Math.max(0, receivable - totalReceived)
  });
});

router.post('/damages/:id/waive', (req, res) => {
  const { handler, waive_reason } = req.body;

  const existing = db.getById('damage_records', req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '破损记录不存在' });
  }

  if (existing.status === 'resolved' || existing.status === 'waived') {
    return res.status(400).json({ error: '该记录已处理或已豁免' });
  }

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const receivable = existing.compensation_amount;

  db.update('damage_records', req.params.id, {
    status: 'waived',
    waive_reason: waive_reason || '协商豁免',
    waive_time: now,
    waive_handler: handler || '管理员',
    received_amount: existing.received_amount || 0,
    remaining_amount: receivable,
    waived_amount: receivable,
    resolved_time: now,
    handler: handler || existing.handler || '管理员'
  });

  res.json({ message: `已豁免赔偿金额 ¥${receivable.toFixed(2)}` });
});

router.post('/damages/:id/add-payment', (req, res) => {
  const { handler, received_amount, payment_method, remark } = req.body;

  const existing = db.getById('damage_records', req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '破损记录不存在' });
  }

  if (existing.status === 'waived') {
    return res.status(400).json({ error: '该记录已豁免，无法添加收款' });
  }

  if (existing.status === 'resolved') {
    return res.status(400).json({ error: '该记录已处理完成' });
  }

  if (received_amount === undefined || isNaN(parseFloat(received_amount)) || parseFloat(received_amount) <= 0) {
    return res.status(400).json({ error: '收款金额必须大于0' });
  }

  const receivable = existing.compensation_amount;
  const actualReceived = parseFloat(received_amount);
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

  let paymentRecords = [];
  try {
    paymentRecords = typeof existing.payment_records === 'string' 
      ? JSON.parse(existing.payment_records) 
      : existing.payment_records || [];
  } catch (e) {
    paymentRecords = [];
  }
  paymentRecords.push({
    received_amount: actualReceived,
    payment_method: payment_method || '现金',
    handler: handler || '管理员',
    receive_time: now,
    remark: remark || ''
  });

  const totalReceived = paymentRecords.reduce((sum, r) => sum + (parseFloat(r.received_amount) || 0), 0);
  let newStatus = existing.status;
  if (totalReceived >= receivable) {
    newStatus = 'resolved';
  } else if (totalReceived > 0) {
    newStatus = 'partial';
  }

  db.update('damage_records', req.params.id, {
    status: newStatus,
    received_amount: totalReceived,
    remaining_amount: Math.max(0, receivable - totalReceived),
    resolved_time: newStatus === 'resolved' ? now : existing.resolved_time,
    payment_records: JSON.stringify(paymentRecords),
    handler: handler || existing.handler || '管理员'
  });

  res.json({
    message: '添加收款成功',
    status: newStatus,
    total_received: totalReceived,
    remaining_amount: Math.max(0, receivable - totalReceived)
  });
});

router.get('/damages/:id/payments', (req, res) => {
  const existing = db.getById('damage_records', req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '破损记录不存在' });
  }

  let paymentRecords = [];
  try {
    paymentRecords = typeof existing.payment_records === 'string' 
      ? JSON.parse(existing.payment_records) 
      : existing.payment_records || [];
  } catch (e) {
    paymentRecords = [];
  }

  res.json({
    damage_record: existing,
    payment_records: paymentRecords
  });
});

module.exports = router;
