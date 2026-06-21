const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');

const dbPath = path.join(__dirname, 'data.json');

let data = {
  costumes: [],
  costume_batches: [],
  troupes: [],
  cycle_rules: [],
  rental_schedules: [],
  outbound_records: [],
  outbound_items: [],
  return_records: [],
  return_items: [],
  damage_records: []
};

let nextIds = {
  costumes: 1,
  costume_batches: 1,
  troupes: 1,
  cycle_rules: 1,
  rental_schedules: 1,
  outbound_records: 1,
  outbound_items: 1,
  return_records: 1,
  return_items: 1,
  damage_records: 1
};

function loadData() {
  if (fs.existsSync(dbPath)) {
    try {
      const fileContent = fs.readFileSync(dbPath, 'utf-8');
      const saved = JSON.parse(fileContent);
      data = saved.data || data;
      nextIds = saved.nextIds || nextIds;
      return true;
    } catch (e) {
      console.error('加载数据失败:', e.message);
    }
  }
  return false;
}

function saveData() {
  try {
    fs.writeFileSync(dbPath, JSON.stringify({ data, nextIds }, null, 2), 'utf-8');
  } catch (e) {
    console.error('保存数据失败:', e.message);
  }
}

function getNextId(table) {
  const id = nextIds[table];
  nextIds[table]++;
  return id;
}

function now() {
  return dayjs().format('YYYY-MM-DD HH:mm:ss');
}

function seedData() {
  const costumeNames = [
    { name: '京剧凤冠霞帔', category: '戏曲服', size: '均码', color: '红色', description: '传统京剧新娘服装，刺绣精美', daily_rate: 180, damage_deposit: 500 },
    { name: '汉服齐胸襦裙', category: '汉服', size: 'M', color: '淡粉色', description: '唐代风格齐胸襦裙，飘逸灵动', daily_rate: 120, damage_deposit: 300 },
    { name: '芭蕾舞裙', category: '舞蹈服', size: 'S', color: '白色', description: '专业芭蕾舞演出服', daily_rate: 150, damage_deposit: 400 },
    { name: '燕尾服', category: '正装', size: 'L', color: '黑色', description: '男士正式演出燕尾服', daily_rate: 200, damage_deposit: 600 },
    { name: '少数民族服饰', category: '民族服', size: '均码', color: '彩色', description: '苗族风格演出服饰，银饰齐全', daily_rate: 160, damage_deposit: 450 },
  ];

  const today = dayjs();

  costumeNames.forEach((costume, idx) => {
    const costumeId = getNextId('costumes');
    const costumeRecord = {
      id: costumeId,
      ...costume,
      total_quantity: 0,
      created_at: now(),
      updated_at: now()
    };
    data.costumes.push(costumeRecord);

    const batchesData = [
      { days: 180, qty: 10, price: 800, supplier: '锦绣服装制造厂' },
      { days: 365, qty: 8, price: 850, supplier: '锦绣服装制造厂' },
      { days: 3, qty: 5, price: 750, supplier: '华彩演出服有限公司' },
    ];

    let totalQty = 0;
    batchesData.forEach((b, bIdx) => {
      const batchId = getNextId('costume_batches');
      const batchNo = `BATCH-${String(idx + 1).padStart(4, '0')}-0${bIdx + 1}`;
      const expiryDate = today.add(b.days, 'day').format('YYYY-MM-DD');
      const isExpired = today.add(b.days, 'day').isBefore(today, 'day');
      
      data.costume_batches.push({
        id: batchId,
        costume_id: costumeId,
        batch_no: batchNo,
        quantity: b.qty,
        available_quantity: b.qty,
        expiry_date: expiryDate,
        purchase_price: b.price,
        supplier: b.supplier,
        inbound_date: now(),
        status: isExpired ? 'expired' : 'normal',
        remark: null,
        created_at: now()
      });
      totalQty += b.qty;
    });

    costumeRecord.total_quantity = totalQty;
  });

  const troupes = [
    { name: '北京京剧团', contact_person: '王团长', phone: '13800138001', address: '北京市西城区京剧大院', is_cooperative: 1, remark: '长期合作伙伴，每周三演出' },
    { name: '上海舞蹈剧院', contact_person: '李经理', phone: '13900139002', address: '上海市徐汇区舞蹈艺术中心', is_cooperative: 1, remark: '每月15号固定演出' },
    { name: '星光艺术团', contact_person: '张老师', phone: '13700137003', address: '广州市天河区艺术大厦', is_cooperative: 0, remark: '散客合作' },
  ];

  troupes.forEach(troupe => {
    const id = getNextId('troupes');
    data.troupes.push({
      id,
      ...troupe,
      created_at: now()
    });
  });

  saveData();
}

function initDatabase() {
  const loaded = loadData();
  if (!loaded || data.costumes.length === 0) {
    seedData();
  }
}

function getAll(table) {
  return [...data[table]];
}

function getById(table, id) {
  return data[table].find(item => item.id == id);
}

function filter(table, conditions) {
  return data[table].filter(item => {
    for (const key in conditions) {
      if (conditions[key] !== undefined && conditions[key] !== null && conditions[key] !== '') {
        if (item[key] != conditions[key]) {
          return false;
        }
      }
    }
    return true;
  });
}

function insert(table, record) {
  const id = getNextId(table);
  const newRecord = {
    id,
    ...record,
    created_at: record.created_at || now()
  };
  data[table].push(newRecord);
  saveData();
  return { lastInsertRowid: id, changes: 1 };
}

function update(table, id, updates) {
  const index = data[table].findIndex(item => item.id == id);
  if (index === -1) {
    return { changes: 0 };
  }
  data[table][index] = {
    ...data[table][index],
    ...updates,
    id: data[table][index].id
  };
  saveData();
  return { changes: 1 };
}

function remove(table, id) {
  const index = data[table].findIndex(item => item.id == id);
  if (index === -1) {
    return { changes: 0 };
  }
  data[table].splice(index, 1);
  saveData();
  return { changes: 1 };
}

function transaction(fn) {
  fn();
  saveData();
}

initDatabase();

module.exports = {
  data,
  getAll,
  getById,
  filter,
  insert,
  update,
  remove,
  transaction,
  saveData
};
