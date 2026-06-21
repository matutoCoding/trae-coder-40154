const express = require('express');
const router = express.Router();
const db = require('../database');
const dayjs = require('dayjs');

router.get('/', (req, res) => {
  const { keyword, is_cooperative } = req.query;
  let troupes = db.getAll('troupes');

  if (keyword) {
    const kw = keyword.toLowerCase();
    troupes = troupes.filter(t => 
      t.name.toLowerCase().includes(kw) ||
      (t.contact_person && t.contact_person.toLowerCase().includes(kw)) ||
      (t.phone && t.phone.toLowerCase().includes(kw))
    );
  }
  if (is_cooperative !== undefined && is_cooperative !== '') {
    troupes = troupes.filter(t => t.is_cooperative == is_cooperative);
  }

  troupes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(troupes);
});

router.get('/cooperative', (req, res) => {
  const troupes = db.getAll('troupes')
    .filter(t => t.is_cooperative === 1 || t.is_cooperative === true)
    .sort((a, b) => a.name.localeCompare(b.name));
  res.json(troupes);
});

router.get('/:id', (req, res) => {
  const troupe = db.getById('troupes', req.params.id);
  if (!troupe) {
    return res.status(404).json({ error: '剧团不存在' });
  }

  const cycleRules = db.filter('cycle_rules', { troupe_id: troupe.id })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  res.json({ ...troupe, cycle_rules: cycleRules });
});

router.post('/', (req, res) => {
  const { name, contact_person, phone, address, is_cooperative, remark } = req.body;

  if (!name) {
    return res.status(400).json({ error: '剧团名称不能为空' });
  }

  const info = db.insert('troupes', {
    name,
    contact_person: contact_person || null,
    phone: phone || null,
    address: address || null,
    is_cooperative: is_cooperative ? 1 : 0,
    remark: remark || null
  });

  const troupe = db.getById('troupes', info.lastInsertRowid);
  res.status(201).json(troupe);
});

router.put('/:id', (req, res) => {
  const { name, contact_person, phone, address, is_cooperative, remark } = req.body;

  const existing = db.getById('troupes', req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '剧团不存在' });
  }

  db.update('troupes', req.params.id, {
    name: name || existing.name,
    contact_person: contact_person !== undefined ? contact_person : existing.contact_person,
    phone: phone !== undefined ? phone : existing.phone,
    address: address !== undefined ? address : existing.address,
    is_cooperative: is_cooperative !== undefined ? (is_cooperative ? 1 : 0) : existing.is_cooperative,
    remark: remark !== undefined ? remark : existing.remark
  });

  const troupe = db.getById('troupes', req.params.id);
  res.json(troupe);
});

router.delete('/:id', (req, res) => {
  const result = db.remove('troupes', req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: '剧团不存在' });
  }
  res.json({ message: '删除成功' });
});

module.exports = router;
