const express = require('express');
const router = express.Router();
const db = require('../database');
const dayjs = require('dayjs');

router.get('/', (req, res) => {
  const { troupe_id, status, start_date, end_date, costume_id, cycle_rule_id } = req.query;
  let schedules = db.getAll('rental_schedules');

  if (troupe_id) {
    schedules = schedules.filter(s => s.troupe_id == troupe_id);
  }
  if (status) {
    schedules = schedules.filter(s => s.status === status);
  }
  if (costume_id) {
    schedules = schedules.filter(s => s.costume_id == costume_id);
  }
  if (cycle_rule_id) {
    schedules = schedules.filter(s => s.cycle_rule_id == cycle_rule_id);
  }
  if (start_date) {
    schedules = schedules.filter(s => s.end_date >= start_date);
  }
  if (end_date) {
    schedules = schedules.filter(s => s.start_date <= end_date);
  }

  schedules.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
  
  schedules = schedules.map(s => {
    const days = dayjs(s.end_date).diff(dayjs(s.start_date), 'day') + 1;
    return {
      ...s,
      rental_days: days > 0 ? days : 1,
      total_amount: Math.max(0, (s.daily_rate || 0) * (days > 0 ? days : 1) * (s.quantity || 0))
    };
  });
  
  res.json(schedules);
});

router.get('/calendar', (req, res) => {
  const { start_date, end_date } = req.query;
  
  let schedules = db.getAll('rental_schedules');
  
  if (start_date) {
    schedules = schedules.filter(s => s.end_date >= start_date);
  }
  if (end_date) {
    schedules = schedules.filter(s => s.start_date <= end_date);
  }

  schedules = schedules.map(s => {
    const troupe = db.getById('troupes', s.troupe_id);
    const costume = db.getById('costumes', s.costume_id);
    return {
      ...s,
      troupe_name: troupe?.name || s.troupe_name,
      costume_name: costume?.name || s.costume_name
    };
  });

  schedules.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
  res.json(schedules);
});

router.get('/:id', (req, res) => {
  const schedule = db.getById('rental_schedules', req.params.id);
  if (!schedule) {
    return res.status(404).json({ error: '排期不存在' });
  }

  const troupe = schedule.troupe_id ? db.getById('troupes', schedule.troupe_id) : null;
  const costume = db.getById('costumes', schedule.costume_id);

  const outboundRecords = db.filter('outbound_records', { schedule_id: schedule.id })
    .sort((a, b) => new Date(b.outbound_date) - new Date(a.outbound_date));

  const returnRecords = db.filter('return_records', { schedule_id: schedule.id })
    .sort((a, b) => new Date(b.return_date) - new Date(a.return_date));

  const damageRecords = db.filter('damage_records', { schedule_id: schedule.id })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  res.json({
    ...schedule,
    troupe_name: troupe?.name || schedule.troupe_name,
    costume_name: costume?.name || schedule.costume_name,
    costume_category: costume?.category,
    outbound_records: outboundRecords,
    return_records: returnRecords,
    damage_records: damageRecords
  });
});

router.post('/', (req, res) => {
  const {
    troupe_id, troupe_name, costume_id, costume_name, quantity,
    start_date, end_date, rental_days, daily_rate, damage_deposit,
    contact_person, phone, remark
  } = req.body;

  if (!costume_id || !quantity || !start_date || !end_date) {
    return res.status(400).json({ error: '服装ID、数量、起止日期不能为空' });
  }

  const qty = parseInt(quantity);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ error: '数量必须大于0' });
  }

  if (dayjs(end_date).isBefore(dayjs(start_date), 'day')) {
    return res.status(400).json({ error: '归还日期不能早于起租日期' });
  }

  const scheduleNo = `SCH-${dayjs().format('YYYYMMDD')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
  
  const days = rental_days || dayjs(end_date).diff(dayjs(start_date), 'day') + 1;
  const validDays = days > 0 ? days : 1;
  const totalAmount = Math.max(0, (daily_rate || 0) * validDays * qty);

  const costume = db.getById('costumes', costume_id);

  const info = db.insert('rental_schedules', {
    schedule_no: scheduleNo,
    troupe_id: troupe_id || null,
    troupe_name: troupe_name || null,
    cycle_rule_id: null,
    costume_id: parseInt(costume_id),
    costume_name: costume_name || costume?.name || '',
    batch_id: null,
    batch_no: null,
    quantity: qty,
    start_date,
    end_date,
    rental_days: validDays,
    daily_rate: daily_rate || 0,
    total_amount: totalAmount,
    damage_deposit: damage_deposit || 0,
    status: 'reserved',
    contact_person: contact_person || null,
    phone: phone || null,
    remark: remark || null
  });

  const schedule = db.getById('rental_schedules', info.lastInsertRowid);
  res.status(201).json(schedule);
});

router.put('/:id', (req, res) => {
  const {
    troupe_id, troupe_name, costume_id, costume_name, quantity,
    start_date, end_date, rental_days, daily_rate, damage_deposit,
    contact_person, phone, remark, status
  } = req.body;

  const existing = db.getById('rental_schedules', req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '排期不存在' });
  }

  if (existing.status !== 'reserved' && existing.batch_id) {
    return res.status(400).json({ error: '已出库的排期不能修改，请先办理归还' });
  }

  const newStart = start_date || existing.start_date;
  const newEnd = end_date || existing.end_date;
  
  if (dayjs(newEnd).isBefore(dayjs(newStart), 'day')) {
    return res.status(400).json({ error: '归还日期不能早于起租日期' });
  }

  let qty = quantity !== undefined ? parseInt(quantity) : existing.quantity;
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ error: '数量必须大于0' });
  }

  const days = rental_days || dayjs(newEnd).diff(dayjs(newStart), 'day') + 1;
  const validDays = days > 0 ? days : 1;
  const rate = daily_rate !== undefined ? daily_rate : existing.daily_rate;
  const totalAmount = Math.max(0, rate * validDays * qty);

  db.update('rental_schedules', req.params.id, {
    troupe_id: troupe_id !== undefined ? troupe_id : existing.troupe_id,
    troupe_name: troupe_name !== undefined ? troupe_name : existing.troupe_name,
    costume_id: costume_id !== undefined ? parseInt(costume_id) : existing.costume_id,
    costume_name: costume_name !== undefined ? costume_name : existing.costume_name,
    quantity: qty,
    start_date: newStart,
    end_date: newEnd,
    rental_days: validDays,
    daily_rate: rate,
    total_amount: totalAmount,
    damage_deposit: damage_deposit !== undefined ? damage_deposit : existing.damage_deposit,
    contact_person: contact_person !== undefined ? contact_person : existing.contact_person,
    phone: phone !== undefined ? phone : existing.phone,
    remark: remark !== undefined ? remark : existing.remark,
    status: status || existing.status
  });

  const schedule = db.getById('rental_schedules', req.params.id);
  res.json(schedule);
});

router.delete('/:id', (req, res) => {
  const existing = db.getById('rental_schedules', req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '排期不存在' });
  }

  if (existing.status !== 'reserved') {
    return res.status(400).json({ error: '只能删除预约状态的排期' });
  }

  db.remove('rental_schedules', req.params.id);
  res.json({ message: '删除成功' });
});

router.post('/:id/confirm', (req, res) => {
  const schedule = db.getById('rental_schedules', req.params.id);
  if (!schedule) {
    return res.status(404).json({ error: '排期不存在' });
  }
  if (schedule.status !== 'reserved') {
    return res.status(400).json({ error: '只能确认预约状态的排期' });
  }

  db.update('rental_schedules', req.params.id, { status: 'confirmed' });
  res.json({ message: '排期已确认' });
});

router.post('/:id/cancel', (req, res) => {
  const schedule = db.getById('rental_schedules', req.params.id);
  if (!schedule) {
    return res.status(404).json({ error: '排期不存在' });
  }

  if (schedule.status === 'outbound') {
    return res.status(400).json({ error: '已出库的排期不能取消，请先办理归还' });
  }

  db.update('rental_schedules', req.params.id, { status: 'cancelled' });
  res.json({ message: '排期已取消' });
});

router.post('/batch-create', (req, res) => {
  const { schedules } = req.body;
  
  if (!Array.isArray(schedules) || schedules.length === 0) {
    return res.status(400).json({ error: '排期数据不能为空' });
  }

  const created = [];

  db.transaction(() => {
    schedules.forEach(schedule => {
      const {
        troupe_id, troupe_name, costume_id, costume_name, quantity,
        start_date, end_date, rental_days, daily_rate, damage_deposit,
        contact_person, phone, remark
      } = schedule;

      const qty = parseInt(quantity);
      if (isNaN(qty) || qty <= 0) {
        throw new Error('数量必须大于0');
      }

      if (dayjs(end_date).isBefore(dayjs(start_date), 'day')) {
        throw new Error('归还日期不能早于起租日期');
      }

      const scheduleNo = `SCH-${dayjs().format('YYYYMMDD')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
      const days = rental_days || dayjs(end_date).diff(dayjs(start_date), 'day') + 1;
      const validDays = days > 0 ? days : 1;
      const totalAmount = Math.max(0, (daily_rate || 0) * validDays * qty);

      const info = db.insert('rental_schedules', {
        schedule_no: scheduleNo,
        troupe_id: troupe_id || null,
        troupe_name: troupe_name || null,
        cycle_rule_id: null,
        costume_id: parseInt(costume_id),
        costume_name: costume_name || '',
        batch_id: null,
        batch_no: null,
        quantity: qty,
        start_date,
        end_date,
        rental_days: validDays,
        daily_rate: daily_rate || 0,
        total_amount: totalAmount,
        damage_deposit: damage_deposit || 0,
        status: 'reserved',
        contact_person: contact_person || null,
        phone: phone || null,
        remark: remark || null
      });

      created.push({
        id: info.lastInsertRowid,
        schedule_no: scheduleNo,
        costume_name,
        start_date,
        end_date
      });
    });
  });

  res.status(201).json({
    message: `成功创建 ${created.length} 条排期`,
    count: created.length,
    schedules: created
  });
});

module.exports = router;
