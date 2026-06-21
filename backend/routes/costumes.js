const express = require('express');
const router = express.Router();
const db = require('../database');
const dayjs = require('dayjs');

router.get('/', (req, res) => {
  const { keyword, category } = req.query;
  let costumes = db.getAll('costumes');

  if (keyword) {
    const kw = keyword.toLowerCase();
    costumes = costumes.filter(c => 
      c.name.toLowerCase().includes(kw) || 
      (c.description && c.description.toLowerCase().includes(kw))
    );
  }
  if (category) {
    costumes = costumes.filter(c => c.category === category);
  }

  costumes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  costumes = costumes.map(costume => {
    const batches = db.filter('costume_batches', { costume_id: costume.id })
      .filter(b => b.status === 'normal');
    
    const totalQty = batches.reduce((sum, b) => sum + b.quantity, 0);
    const availableQty = batches.reduce((sum, b) => sum + b.available_quantity, 0);
    
    let nearestExpiry = null;
    if (batches.length > 0) {
      nearestExpiry = batches
        .map(b => b.expiry_date)
        .sort((a, b) => new Date(a) - new Date(b))[0];
    }

    let expiry_status = 'normal';
    let days_to_expiry = null;
    if (nearestExpiry) {
      days_to_expiry = dayjs(nearestExpiry).diff(dayjs(), 'day');
      expiry_status = days_to_expiry < 0 ? 'expired' : days_to_expiry <= 30 ? 'warning' : 'normal';
    }

    return {
      ...costume,
      total_quantity: totalQty,
      available_quantity: availableQty,
      nearest_expiry: nearestExpiry,
      expiry_status,
      days_to_expiry
    };
  });

  res.json(costumes);
});

router.get('/categories/list', (req, res) => {
  const categories = [...new Set(db.getAll('costumes').map(c => c.category).filter(Boolean))];
  res.json(categories);
});

router.get('/:id', (req, res) => {
  const costume = db.getById('costumes', req.params.id);
  if (!costume) {
    return res.status(404).json({ error: '服装不存在' });
  }

  let batches = db.filter('costume_batches', { costume_id: costume.id });
  batches.sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));
  
  batches = batches.map(batch => {
    const daysToExpiry = dayjs(batch.expiry_date).diff(dayjs(), 'day');
    return {
      ...batch,
      days_to_expiry: daysToExpiry,
      expiry_status: batch.status === 'locked' ? 'locked' : 
        daysToExpiry < 0 ? 'expired' : daysToExpiry <= 30 ? 'warning' : 'normal'
    };
  });

  res.json({ ...costume, batches });
});

router.post('/', (req, res) => {
  const { name, category, size, color, description, daily_rate, damage_deposit } = req.body;

  if (!name || !category) {
    return res.status(400).json({ error: '服装名称和类别不能为空' });
  }

  const info = db.insert('costumes', {
    name,
    category,
    size: size || null,
    color: color || null,
    description: description || null,
    daily_rate: daily_rate || 0,
    damage_deposit: damage_deposit || 0,
    total_quantity: 0,
    updated_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
  });

  const costume = db.getById('costumes', info.lastInsertRowid);
  res.status(201).json(costume);
});

router.put('/:id', (req, res) => {
  const { name, category, size, color, description, daily_rate, damage_deposit } = req.body;

  const existing = db.getById('costumes', req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '服装不存在' });
  }

  db.update('costumes', req.params.id, {
    name: name || existing.name,
    category: category || existing.category,
    size: size !== undefined ? size : existing.size,
    color: color !== undefined ? color : existing.color,
    description: description !== undefined ? description : existing.description,
    daily_rate: daily_rate !== undefined ? daily_rate : existing.daily_rate,
    damage_deposit: damage_deposit !== undefined ? damage_deposit : existing.damage_deposit,
    updated_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
  });

  const costume = db.getById('costumes', req.params.id);
  res.json(costume);
});

router.delete('/:id', (req, res) => {
  const result = db.remove('costumes', req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: '服装不存在' });
  }
  res.json({ message: '删除成功' });
});

module.exports = router;
