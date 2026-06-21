const express = require('express');
const router = express.Router();
const db = require('../database');
const dayjs = require('dayjs');

function getRuleWithDetails(rule) {
  const troupe = db.getById('troupes', rule.troupe_id);
  let costume_list_parsed = [];
  try {
    costume_list_parsed = typeof rule.costume_list === 'string' 
      ? JSON.parse(rule.costume_list) 
      : rule.costume_list || [];
  } catch (e) {
    costume_list_parsed = [];
  }
  return {
    ...rule,
    troupe_name: troupe?.name,
    contact_person: troupe?.contact_person,
    phone: troupe?.phone,
    costume_list_parsed
  };
}

router.get('/', (req, res) => {
  const { troupe_id, status } = req.query;
  let rules = db.getAll('cycle_rules');

  if (troupe_id) {
    rules = rules.filter(r => r.troupe_id == troupe_id);
  }
  if (status) {
    rules = rules.filter(r => r.status === status);
  }

  rules.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const result = rules.map(r => getRuleWithDetails(r));
  res.json(result);
});

router.get('/:id', (req, res) => {
  const rule = db.getById('cycle_rules', req.params.id);
  if (!rule) {
    return res.status(404).json({ error: '周期规则不存在' });
  }
  res.json(getRuleWithDetails(rule));
});

router.post('/', (req, res) => {
  const { 
    troupe_id, name, cycle_type, start_date, end_date,
    day_of_week, day_of_month, rental_days, costume_list
  } = req.body;

  if (!troupe_id || !name || !cycle_type || !start_date || !rental_days || !costume_list) {
    return res.status(400).json({ error: '必填项不能为空' });
  }

  const costumeListStr = typeof costume_list === 'string' ? costume_list : JSON.stringify(costume_list);

  const info = db.insert('cycle_rules', {
    troupe_id: parseInt(troupe_id),
    name,
    cycle_type,
    start_date,
    end_date: end_date || null,
    day_of_week: day_of_week !== undefined ? parseInt(day_of_week) : null,
    day_of_month: day_of_month !== undefined ? parseInt(day_of_month) : null,
    rental_days: parseInt(rental_days),
    costume_list: costumeListStr,
    status: 'active'
  });

  const rule = db.getById('cycle_rules', info.lastInsertRowid);
  res.status(201).json(getRuleWithDetails(rule));
});

router.put('/:id', (req, res) => {
  const { 
    name, cycle_type, start_date, end_date,
    day_of_week, day_of_month, rental_days, costume_list, status
  } = req.body;

  const existing = db.getById('cycle_rules', req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '周期规则不存在' });
  }

  const costumeListStr = costume_list 
    ? (typeof costume_list === 'string' ? costume_list : JSON.stringify(costume_list))
    : existing.costume_list;

  db.update('cycle_rules', req.params.id, {
    name: name || existing.name,
    cycle_type: cycle_type || existing.cycle_type,
    start_date: start_date || existing.start_date,
    end_date: end_date !== undefined ? end_date : existing.end_date,
    day_of_week: day_of_week !== undefined ? parseInt(day_of_week) : existing.day_of_week,
    day_of_month: day_of_month !== undefined ? parseInt(day_of_month) : existing.day_of_month,
    rental_days: rental_days !== undefined ? parseInt(rental_days) : existing.rental_days,
    costume_list: costumeListStr,
    status: status || existing.status
  });

  const rule = db.getById('cycle_rules', req.params.id);
  res.json(getRuleWithDetails(rule));
});

router.delete('/:id', (req, res) => {
  const result = db.remove('cycle_rules', req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: '周期规则不存在' });
  }
  res.json({ message: '删除成功' });
});

function generateCycleDates(rule, startDate, endDate) {
  const dates = [];
  let current = dayjs(startDate);
  const end = dayjs(endDate);

  if (rule.cycle_type === 'weekly' && rule.day_of_week !== null && rule.day_of_week !== undefined) {
    while (current.day() !== rule.day_of_week) {
      current = current.add(1, 'day');
    }
    while (current.isBefore(end) || current.isSame(end, 'day')) {
      dates.push(current.format('YYYY-MM-DD'));
      current = current.add(7, 'day');
    }
  } else if (rule.cycle_type === 'monthly' && rule.day_of_month !== null && rule.day_of_month !== undefined) {
    let currentMonth = dayjs(startDate).startOf('month');
    while (currentMonth.isBefore(end) || currentMonth.isSame(end, 'month')) {
      const targetDate = currentMonth.date(rule.day_of_month);
      if ((targetDate.isAfter(dayjs(startDate)) || targetDate.isSame(dayjs(startDate), 'day')) &&
          (targetDate.isBefore(end) || targetDate.isSame(end, 'day'))) {
        dates.push(targetDate.format('YYYY-MM-DD'));
      }
      currentMonth = currentMonth.add(1, 'month');
    }
  } else if (rule.cycle_type === 'daily') {
    while (current.isBefore(end) || current.isSame(end, 'day')) {
      dates.push(current.format('YYYY-MM-DD'));
      current = current.add(1, 'day');
    }
  }

  return dates;
}

router.post('/:id/generate', (req, res) => {
  const { start_date, end_date } = req.body;
  
  const rule = db.getById('cycle_rules', req.params.id);
  if (!rule) {
    return res.status(404).json({ error: '周期规则不存在' });
  }

  const troupe = db.getById('troupes', rule.troupe_id);
  if (!troupe) {
    return res.status(404).json({ error: '剧团不存在' });
  }

  let costumeList;
  try {
    costumeList = typeof rule.costume_list === 'string' ? JSON.parse(rule.costume_list) : rule.costume_list;
  } catch (e) {
    return res.status(400).json({ error: '服装列表格式错误' });
  }

  const generateStart = start_date || rule.start_date;
  const generateEnd = end_date || rule.end_date || dayjs(generateStart).add(3, 'month').format('YYYY-MM-DD');

  if (!generateEnd) {
    return res.status(400).json({ error: '请指定生成结束日期' });
  }

  const dates = generateCycleDates(rule, generateStart, generateEnd);
  
  const generatedSchedules = [];

  db.transaction(() => {
    dates.forEach((date, dateIdx) => {
      const startDate = dayjs(date);
      const endDate = startDate.add(rule.rental_days - 1, 'day');

      costumeList.forEach((costume, costumeIdx) => {
        const scheduleNo = `SCH-${dayjs().format('YYYYMMDD')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
        
        const dailyRate = costume.daily_rate || 0;
        const totalAmount = dailyRate * rule.rental_days * costume.quantity;

        const info = db.insert('rental_schedules', {
          schedule_no: scheduleNo,
          troupe_id: rule.troupe_id,
          troupe_name: troupe.name,
          cycle_rule_id: rule.id,
          costume_id: costume.costume_id,
          costume_name: costume.costume_name,
          batch_id: null,
          batch_no: null,
          quantity: costume.quantity,
          start_date: startDate.format('YYYY-MM-DD'),
          end_date: endDate.format('YYYY-MM-DD'),
          rental_days: rule.rental_days,
          daily_rate: dailyRate,
          total_amount: totalAmount,
          damage_deposit: costume.damage_deposit || 0,
          status: 'reserved',
          contact_person: troupe.contact_person,
          phone: troupe.phone,
          remark: null
        });

        generatedSchedules.push({
          id: info.lastInsertRowid,
          schedule_no: scheduleNo,
          costume_name: costume.costume_name,
          quantity: costume.quantity,
          start_date: startDate.format('YYYY-MM-DD'),
          end_date: endDate.format('YYYY-MM-DD')
        });
      });
    });
  });

  res.json({
    message: `成功生成 ${generatedSchedules.length} 条排期`,
    count: generatedSchedules.length,
    schedules: generatedSchedules.slice(0, 20)
  });
});

module.exports = router;
