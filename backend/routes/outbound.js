const express = require('express');
const router = express.Router();
const db = require('../database');
const dayjs = require('dayjs');
const { getAvailableBatches } = require('./batches');

router.get('/', (req, res) => {
  const { schedule_id, costume_id, keyword } = req.query;
  let records = db.getAll('outbound_records');

  if (schedule_id) {
    records = records.filter(r => r.schedule_id == schedule_id);
  }
  if (costume_id) {
    records = records.filter(r => r.costume_id == costume_id);
  }
  if (keyword) {
    const kw = keyword.toLowerCase();
    records = records.filter(r => 
      r.outbound_no.toLowerCase().includes(kw) ||
      r.costume_name.toLowerCase().includes(kw)
    );
  }

  records.sort((a, b) => new Date(b.outbound_date) - new Date(a.outbound_date));
  
  const result = records.map(r => {
    const items = db.filter('outbound_items', { outbound_id: r.id });
    return { ...r, items };
  });

  res.json(result);
});

router.get('/:id', (req, res) => {
  const record = db.getById('outbound_records', req.params.id);
  if (!record) {
    return res.status(404).json({ error: '出库记录不存在' });
  }

  const items = db.filter('outbound_items', { outbound_id: record.id });
  const itemWithBatch = items.map(item => {
    const batch = db.getById('costume_batches', item.batch_id);
    return {
      ...item,
      expiry_date: batch?.expiry_date,
      batch_status: batch?.status
    };
  });

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

  let returnInfo = null;
  if (record.schedule_id) {
    const ret = db.filter('return_records', { schedule_id: record.schedule_id })[0];
    if (ret) {
      returnInfo = {
        id: ret.id,
        return_no: ret.return_no,
        return_date: ret.return_date
      };
    }
  }

  res.json({ ...record, items: itemWithBatch, schedule: scheduleInfo, return_record: returnInfo });
});

router.get('/by-schedule/:scheduleId', (req, res) => {
  const scheduleId = req.params.scheduleId;
  
  const outbound = db.filter('outbound_records', { schedule_id: scheduleId })
    .sort((a, b) => b.id - a.id)[0];
  
  if (!outbound) {
    return res.status(404).json({ error: '未找到该排期的出库记录' });
  }

  const items = db.filter('outbound_items', { outbound_id: outbound.id });
  res.json({ ...outbound, items });
});

router.post('/by-schedule/:scheduleId', (req, res) => {
  const { operator, remark } = req.body;
  const scheduleId = req.params.scheduleId;

  const schedule = db.getById('rental_schedules', scheduleId);
  if (!schedule) {
    return res.status(404).json({ error: '排期不存在' });
  }

  if (schedule.status === 'outbound') {
    return res.status(400).json({ error: '该排期已出库' });
  }
  if (schedule.status === 'cancelled') {
    return res.status(400).json({ error: '该排期已取消' });
  }
  if (schedule.status === 'returned') {
    return res.status(400).json({ error: '该排期已归还' });
  }

  const result = getAvailableBatches(schedule.costume_id, schedule.quantity);
  
  if (result.remaining > 0) {
    return res.status(400).json({
      error: '库存不足，无法出库',
      available: result.totalAvailable,
      requested: schedule.quantity
    });
  }

  const outboundNo = `OUT-${dayjs().format('YYYYMMDD')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;

  let firstBatchId = null;
  let firstBatchNo = null;

  const nowStr = dayjs().format('YYYY-MM-DD HH:mm:ss');

  db.transaction(() => {
    const info = db.insert('outbound_records', {
      outbound_no: outboundNo,
      schedule_id: parseInt(scheduleId),
      costume_id: schedule.costume_id,
      costume_name: schedule.costume_name,
      total_quantity: schedule.quantity,
      operator: operator || '系统',
      status: 'outbound',
      remark: remark || null,
      outbound_date: nowStr
    });

    const outboundId = info.lastInsertRowid;

    result.batches.forEach(batch => {
      db.insert('outbound_items', {
        outbound_id: outboundId,
        batch_id: batch.batch_id,
        batch_no: batch.batch_no,
        quantity: batch.quantity,
        expiry_date: batch.expiry_date
      });

      const batchRecord = db.getById('costume_batches', batch.batch_id);
      if (batchRecord) {
        db.update('costume_batches', batch.batch_id, {
          available_quantity: batchRecord.available_quantity - batch.quantity
        });
      }

      if (!firstBatchId) {
        firstBatchId = batch.batch_id;
        firstBatchNo = batch.batch_no;
      }
    });

    db.update('rental_schedules', scheduleId, {
      status: 'outbound',
      batch_id: firstBatchId,
      batch_no: firstBatchNo
    });
  });

  const outboundRecord = db.getById('outbound_records', 
    db.getAll('outbound_records').find(r => r.outbound_no === outboundNo)?.id
  );
  const items = db.filter('outbound_items', { outbound_id: outboundRecord.id });
  
  res.status(201).json({ ...outboundRecord, items });
});

router.post('/direct', (req, res) => {
  const { costume_id, costume_name, quantity, operator, remark } = req.body;

  if (!costume_id || !quantity) {
    return res.status(400).json({ error: '服装ID和数量不能为空' });
  }

  const qty = parseInt(quantity);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ error: '数量必须大于0' });
  }

  const costume = db.getById('costumes', costume_id);
  if (!costume) {
    return res.status(404).json({ error: '服装不存在' });
  }

  const result = getAvailableBatches(costume_id, qty);
  
  if (result.remaining > 0) {
    return res.status(400).json({
      error: '库存不足',
      available: result.totalAvailable,
      requested: qty
    });
  }

  const outboundNo = `OUT-${dayjs().format('YYYYMMDD')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
  const nowStr = dayjs().format('YYYY-MM-DD HH:mm:ss');

  db.transaction(() => {
    const info = db.insert('outbound_records', {
      outbound_no: outboundNo,
      schedule_id: null,
      costume_id: parseInt(costume_id),
      costume_name: costume_name || costume.name,
      total_quantity: qty,
      operator: operator || '系统',
      status: 'outbound',
      remark: remark || null,
      outbound_date: nowStr
    });

    const outboundId = info.lastInsertRowid;

    result.batches.forEach(batch => {
      db.insert('outbound_items', {
        outbound_id: outboundId,
        batch_id: batch.batch_id,
        batch_no: batch.batch_no,
        quantity: batch.quantity,
        expiry_date: batch.expiry_date
      });

      const batchRecord = db.getById('costume_batches', batch.batch_id);
      if (batchRecord) {
        db.update('costume_batches', batch.batch_id, {
          available_quantity: batchRecord.available_quantity - batch.quantity
        });
      }
    });
  });

  const record = db.getAll('outbound_records').find(r => r.outbound_no === outboundNo);
  const items = db.filter('outbound_items', { outbound_id: record.id });
  
  res.status(201).json({ ...record, items });
});

router.post('/preview-fifo/:costumeId/:quantity', (req, res) => {
  const { costumeId, quantity } = req.params;
  const qty = parseInt(quantity);

  const result = getAvailableBatches(costumeId, qty);
  
  res.json({
    costume_id: costumeId,
    requested_quantity: qty,
    available_quantity: result.totalAvailable,
    remaining: result.remaining,
    batches: result.batches,
    can_outbound: result.remaining === 0
  });
});

module.exports = router;
