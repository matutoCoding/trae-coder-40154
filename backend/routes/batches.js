const express = require('express');
const router = express.Router();
const db = require('../database');
const dayjs = require('dayjs');

function getBatchWithDetails(batch) {
  const costume = db.getById('costumes', batch.costume_id);
  const daysToExpiry = dayjs(batch.expiry_date).diff(dayjs(), 'day');
  
  let expiry_status = 'normal';
  if (batch.status === 'locked') {
    expiry_status = 'locked';
  } else if (daysToExpiry < 0) {
    expiry_status = 'expired';
  } else if (daysToExpiry <= 30) {
    expiry_status = 'warning';
  }

  return {
    ...batch,
    costume_name: costume?.name,
    costume_category: costume?.category,
    days_to_expiry: daysToExpiry,
    expiry_status
  };
}

router.get('/', (req, res) => {
  const { costume_id, status, keyword } = req.query;
  let batches = db.getAll('costume_batches');

  if (costume_id) {
    batches = batches.filter(b => b.costume_id == costume_id);
  }
  if (status) {
    batches = batches.filter(b => b.status === status);
  }
  if (keyword) {
    const kw = keyword.toLowerCase();
    batches = batches.filter(b => {
      const costume = db.getById('costumes', b.costume_id);
      return b.batch_no.toLowerCase().includes(kw) || 
             (costume && costume.name.toLowerCase().includes(kw));
    });
  }

  batches.sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));
  
  const result = batches.map(b => getBatchWithDetails(b));
  res.json(result);
});

router.get('/warning', (req, res) => {
  const { days = 30 } = req.query;
  const warningDate = dayjs().add(parseInt(days), 'day').format('YYYY-MM-DD');
  
  let batches = db.getAll('costume_batches')
    .filter(b => b.status === 'normal' && b.expiry_date <= warningDate);

  batches.sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));

  const result = batches.map(b => getBatchWithDetails(b));
  const expiredCount = result.filter(b => b.days_to_expiry < 0).length;
  const warningCount = result.filter(b => b.days_to_expiry >= 0 && b.days_to_expiry <= 30).length;

  res.json({
    batches: result,
    total: result.length,
    expired_count: expiredCount,
    warning_count: warningCount
  });
});

router.get('/:id', (req, res) => {
  const batch = db.getById('costume_batches', req.params.id);
  if (!batch) {
    return res.status(404).json({ error: '批次不存在' });
  }

  res.json(getBatchWithDetails(batch));
});

router.post('/', (req, res) => {
  const { costume_id, batch_no, quantity, expiry_date, purchase_price, supplier, remark } = req.body;

  if (!costume_id || !batch_no || !quantity || !expiry_date) {
    return res.status(400).json({ error: '服装ID、批号、数量、效期不能为空' });
  }

  const qty = parseInt(quantity);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ error: '数量必须大于0' });
  }

  const costume = db.getById('costumes', costume_id);
  if (!costume) {
    return res.status(404).json({ error: '服装不存在' });
  }

  const existing = db.getAll('costume_batches').find(b => b.batch_no === batch_no);
  if (existing) {
    return res.status(400).json({ error: '批号已存在' });
  }

  const isExpired = dayjs(expiry_date).isBefore(dayjs(), 'day');
  const status = isExpired ? 'expired' : 'normal';
  const nowStr = dayjs().format('YYYY-MM-DD HH:mm:ss');

  const info = db.insert('costume_batches', {
    costume_id: parseInt(costume_id),
    batch_no,
    quantity: qty,
    available_quantity: qty,
    expiry_date,
    purchase_price: purchase_price || 0,
    supplier: supplier || null,
    inbound_date: nowStr,
    status,
    remark: remark || null
  });

  const batch = db.getById('costume_batches', info.lastInsertRowid);
  res.status(201).json(batch);
});

router.put('/:id', (req, res) => {
  const { batch_no, expiry_date, purchase_price, supplier, remark, status } = req.body;

  const existing = db.getById('costume_batches', req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '批次不存在' });
  }

  db.update('costume_batches', req.params.id, {
    batch_no: batch_no || existing.batch_no,
    expiry_date: expiry_date || existing.expiry_date,
    purchase_price: purchase_price !== undefined ? purchase_price : existing.purchase_price,
    supplier: supplier !== undefined ? supplier : existing.supplier,
    remark: remark !== undefined ? remark : existing.remark,
    status: status || existing.status
  });

  const batch = db.getById('costume_batches', req.params.id);
  res.json(batch);
});

router.delete('/:id', (req, res) => {
  const result = db.remove('costume_batches', req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: '批次不存在' });
  }
  res.json({ message: '删除成功' });
});

router.post('/:id/lock', (req, res) => {
  const batch = db.getById('costume_batches', req.params.id);
  if (!batch) {
    return res.status(404).json({ error: '批次不存在' });
  }

  db.update('costume_batches', req.params.id, { status: 'locked' });
  res.json({ message: '批次已锁定', status: 'locked' });
});

router.post('/:id/unlock', (req, res) => {
  const batch = db.getById('costume_batches', req.params.id);
  if (!batch) {
    return res.status(404).json({ error: '批次不存在' });
  }

  const daysToExpiry = dayjs(batch.expiry_date).diff(dayjs(), 'day');
  const newStatus = daysToExpiry < 0 ? 'expired' : 'normal';

  db.update('costume_batches', req.params.id, { status: newStatus });
  res.json({ message: '批次已解锁', status: newStatus });
});

function getAvailableBatches(costumeId, quantity) {
  const today = dayjs().format('YYYY-MM-DD');
  let batches = db.getAll('costume_batches')
    .filter(b => 
      b.costume_id == costumeId && 
      b.status === 'normal' && 
      b.available_quantity > 0 && 
      b.expiry_date >= today
    )
    .sort((a, b) => {
      const dateCompare = new Date(a.expiry_date) - new Date(b.expiry_date);
      if (dateCompare !== 0) return dateCompare;
      return new Date(a.inbound_date) - new Date(b.inbound_date);
    });

  const result = [];
  let remaining = quantity;

  for (const batch of batches) {
    if (remaining <= 0) break;
    
    const takeQty = Math.min(batch.available_quantity, remaining);
    if (takeQty > 0) {
      result.push({
        batch_id: batch.id,
        batch_no: batch.batch_no,
        quantity: takeQty,
        expiry_date: batch.expiry_date
      });
      remaining -= takeQty;
    }
  }

  return { batches: result, remaining, totalAvailable: quantity - remaining };
}

router.get('/fifo/:costumeId/:quantity', (req, res) => {
  const { costumeId, quantity } = req.params;
  const qty = parseInt(quantity);

  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ error: '数量无效' });
  }

  const result = getAvailableBatches(costumeId, qty);
  
  if (result.remaining > 0) {
    return res.status(400).json({ 
      error: '库存不足',
      available: result.totalAvailable,
      requested: qty
    });
  }

  res.json({
    costume_id: costumeId,
    requested_quantity: qty,
    batches: result.batches
  });
});

router.post('/check-availability', (req, res) => {
  const { costume_id, quantity, start_date, end_date, exclude_schedule_id } = req.body;

  if (!costume_id || !start_date || !end_date) {
    return res.status(400).json({ error: '服装ID、起止日期不能为空' });
  }

  const qty = parseInt(quantity) || 0;

  const today = dayjs().format('YYYY-MM-DD');
  let totalAvailable = db.getAll('costume_batches')
    .filter(b => 
      b.costume_id == costume_id && 
      b.status === 'normal' && 
      b.available_quantity > 0 && 
      b.expiry_date >= today
    )
    .reduce((sum, b) => sum + b.available_quantity, 0);

  const overlappingSchedules = db.getAll('rental_schedules').filter(s => {
    if (s.status === 'cancelled' || s.status === 'returned') return false;
    if (exclude_schedule_id && s.id == exclude_schedule_id) return false;
    if (s.costume_id != costume_id) return false;
    
    return (s.start_date <= end_date) && (s.end_date >= start_date);
  });

  const reservedQuantity = overlappingSchedules.reduce((sum, s) => sum + s.quantity, 0);
  const netAvailable = Math.max(0, totalAvailable - reservedQuantity);

  const conflictSchedules = overlappingSchedules.map(s => ({
    id: s.id,
    schedule_no: s.schedule_no,
    troupe_name: s.troupe_name || '散客',
    quantity: s.quantity,
    start_date: s.start_date,
    end_date: s.end_date,
    status: s.status
  }));

  let result = {
    costume_id,
    total_available: totalAvailable,
    reserved_quantity: reservedQuantity,
    net_available: netAvailable,
    requested_quantity: qty,
    is_available: qty <= netAvailable,
    conflict_schedules: conflictSchedules,
    check_status: ''
  };

  if (qty > totalAvailable) {
    result.check_status = 'total';
  } else if (qty > netAvailable) {
    result.check_status = 'conflict';
  } else {
    result.check_status = 'ok';
  }

  res.json(result);
});

module.exports = router;
module.exports.getAvailableBatches = getAvailableBatches;
