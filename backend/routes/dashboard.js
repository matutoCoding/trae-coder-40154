const express = require('express');
const router = express.Router();
const db = require('../database');
const dayjs = require('dayjs');

router.get('/stats', (req, res) => {
  const costumes = db.getAll('costumes');
  const batches = db.getAll('costume_batches');
  const troupes = db.getAll('troupes');
  const schedules = db.getAll('rental_schedules');
  const damages = db.getAll('damage_records');
  const cycleRules = db.getAll('cycle_rules');

  const normalBatches = batches.filter(b => b.status === 'normal');
  const totalQuantity = normalBatches.reduce((sum, b) => sum + b.quantity, 0);
  const availableQuantity = normalBatches.reduce((sum, b) => sum + b.available_quantity, 0);

  const today = dayjs().format('YYYY-MM-DD');
  const warningDate = dayjs().add(30, 'day').format('YYYY-MM-DD');

  const warningBatches = normalBatches.filter(b => 
    b.expiry_date <= warningDate && b.expiry_date >= today
  ).length;

  const expiredBatches = normalBatches.filter(b => 
    b.expiry_date < today
  ).length;

  const lockedBatches = batches.filter(b => b.status === 'locked').length;

  const cooperativeTroupes = troupes.filter(t => t.is_cooperative === 1 || t.is_cooperative === true).length;

  const todaySchedules = schedules.filter(s => 
    s.start_date <= today && s.end_date >= today
  ).length;

  const pendingSchedules = schedules.filter(s => 
    s.status === 'reserved' || s.status === 'confirmed'
  ).length;

  const outboundSchedules = schedules.filter(s => s.status === 'outbound').length;

  const pendingDamages = damages.filter(d => d.status === 'pending').length;

  const activeCycleRules = cycleRules.filter(r => r.status === 'active').length;

  const currentMonth = dayjs().format('YYYY-MM');
  const monthRevenue = schedules
    .filter(s => s.status !== 'cancelled' && dayjs(s.start_date).format('YYYY-MM') === currentMonth)
    .reduce((sum, s) => sum + (s.total_amount || 0), 0);

  res.json({
    costumes: {
      total: costumes.length,
      total_batches: batches.length,
      total_quantity: totalQuantity,
      available_quantity: availableQuantity
    },
    expiry: {
      warning: warningBatches,
      expired: expiredBatches,
      locked: lockedBatches
    },
    troupes: {
      total: troupes.length,
      cooperative: cooperativeTroupes
    },
    schedules: {
      today: todaySchedules,
      pending: pendingSchedules,
      outbound: outboundSchedules
    },
    damages: {
      pending: pendingDamages
    },
    cycle_rules: {
      active: activeCycleRules
    },
    revenue: {
      month: monthRevenue
    }
  });
});

router.get('/warnings', (req, res) => {
  const today = dayjs().format('YYYY-MM-DD');
  const warningDate = dayjs().add(30, 'day').format('YYYY-MM-DD');

  let warningBatches = db.getAll('costume_batches')
    .filter(b => b.status === 'normal' && b.expiry_date <= warningDate && b.expiry_date >= today)
    .sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date))
    .slice(0, 10)
    .map(b => {
      const costume = db.getById('costumes', b.costume_id);
      const daysToExpiry = dayjs(b.expiry_date).diff(dayjs(), 'day');
      return {
        ...b,
        costume_name: costume?.name,
        costume_category: costume?.category,
        days_to_expiry: daysToExpiry,
        expiry_status: 'warning'
      };
    });

  let expiredBatches = db.getAll('costume_batches')
    .filter(b => b.status === 'normal' && b.expiry_date < today)
    .sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date))
    .slice(0, 10)
    .map(b => {
      const costume = db.getById('costumes', b.costume_id);
      const daysToExpiry = dayjs(b.expiry_date).diff(dayjs(), 'day');
      return {
        ...b,
        costume_name: costume?.name,
        costume_category: costume?.category,
        days_to_expiry: daysToExpiry,
        expiry_status: 'expired'
      };
    });

  const pendingDamages = db.getAll('damage_records')
    .filter(d => d.status === 'pending')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 10)
    .map(d => {
      const costume = db.getById('costumes', d.costume_id);
      return {
        ...d,
        costume_name: costume?.name
      };
    });

  const todaySchedules = db.getAll('rental_schedules')
    .filter(s => s.start_date === today && s.status !== 'cancelled')
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
    .slice(0, 10)
    .map(s => {
      const troupe = s.troupe_id ? db.getById('troupes', s.troupe_id) : null;
      return {
        ...s,
        troupe_name: troupe?.name || s.troupe_name
      };
    });

  const lowStockCostumes = db.getAll('costumes').map(c => {
    const availableQty = db.getAll('costume_batches')
      .filter(b => b.costume_id === c.id && b.status === 'normal')
      .reduce((sum, b) => sum + b.available_quantity, 0);
    return {
      id: c.id,
      name: c.name,
      category: c.category,
      available_quantity: availableQty
    };
  })
    .filter(c => c.available_quantity < 5)
    .sort((a, b) => a.available_quantity - b.available_quantity)
    .slice(0, 10);

  res.json({
    warning_batches: warningBatches,
    expired_batches: expiredBatches,
    pending_damages: pendingDamages,
    today_schedules: todaySchedules,
    low_stock: lowStockCostumes
  });
});

router.get('/calendar-data', (req, res) => {
  const { start, end } = req.query;
  
  let schedules = db.getAll('rental_schedules').filter(s => s.status !== 'cancelled');

  if (start) {
    schedules = schedules.filter(s => s.end_date >= start);
  }
  if (end) {
    schedules = schedules.filter(s => s.start_date <= end);
  }

  schedules = schedules.map(s => {
    const troupe = s.troupe_id ? db.getById('troupes', s.troupe_id) : null;
    return {
      ...s,
      troupe_name_full: troupe?.name,
      troupe_name: troupe?.name || s.troupe_name
    };
  });

  schedules.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
  res.json(schedules);
});

module.exports = router;
