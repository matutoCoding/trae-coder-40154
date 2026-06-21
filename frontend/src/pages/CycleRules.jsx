import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { cycleRuleApi, troupeApi, costumeApi } from '../api';
import Modal from '../components/Modal';

function CycleRules() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [troupes, setTroupes] = useState([]);
  const [costumes, setCostumes] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [generateModalVisible, setGenerateModalVisible] = useState(false);
  const [generatingRule, setGeneratingRule] = useState(null);
  const [generateStart, setGenerateStart] = useState(dayjs().format('YYYY-MM-DD'));
  const [generateEnd, setGenerateEnd] = useState(dayjs().add(3, 'month').format('YYYY-MM-DD'));
  
  const [formData, setFormData] = useState({
    troupe_id: '',
    name: '',
    cycle_type: 'weekly',
    start_date: dayjs().format('YYYY-MM-DD'),
    end_date: '',
    day_of_week: 1,
    day_of_month: 1,
    rental_days: 1,
    costume_list: []
  });

  const [newCostume, setNewCostume] = useState({
    costume_id: '',
    costume_name: '',
    quantity: 1,
    daily_rate: 0,
    damage_deposit: 0
  });

  useEffect(() => {
    loadRules();
    loadTroupes();
    loadCostumes();
  }, []);

  const loadRules = async () => {
    try {
      setLoading(true);
      const res = await cycleRuleApi.list();
      setRules(res.data);
    } catch (error) {
      alert('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadTroupes = async () => {
    try {
      const res = await troupeApi.cooperative();
      setTroupes(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadCostumes = async () => {
    try {
      const res = await costumeApi.list();
      setCostumes(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({
      troupe_id: '',
      name: '',
      cycle_type: 'weekly',
      start_date: dayjs().format('YYYY-MM-DD'),
      end_date: '',
      day_of_week: 1,
      day_of_month: 1,
      rental_days: 1,
      costume_list: []
    });
    setModalVisible(true);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      troupe_id: item.troupe_id,
      name: item.name,
      cycle_type: item.cycle_type,
      start_date: item.start_date,
      end_date: item.end_date || '',
      day_of_week: item.day_of_week || 1,
      day_of_month: item.day_of_month || 1,
      rental_days: item.rental_days,
      costume_list: item.costume_list_parsed || []
    });
    setModalVisible(true);
  };

  const handleDelete = async (item) => {
    if (!confirm(`确定删除周期规则"${item.name}"吗？`)) return;
    try {
      await cycleRuleApi.delete(item.id);
      loadRules();
    } catch (error) {
      alert('删除失败');
    }
  };

  const handleGenerate = (item) => {
    setGeneratingRule(item);
    setGenerateStart(dayjs().format('YYYY-MM-DD'));
    setGenerateEnd(dayjs().add(3, 'month').format('YYYY-MM-DD'));
    setGenerateModalVisible(true);
  };

  const doGenerate = async () => {
    if (!generatingRule) return;
    try {
      const res = await cycleRuleApi.generate(generatingRule.id, {
        start_date: generateStart,
        end_date: generateEnd
      });
      alert(res.data.message);
      setGenerateModalVisible(false);
    } catch (error) {
      alert(error.response?.data?.error || '生成失败');
    }
  };

  const handleCostumeSelect = (costumeId) => {
    const costume = costumes.find(c => c.id == costumeId);
    if (costume) {
      setNewCostume({
        costume_id: costume.id,
        costume_name: costume.name,
        quantity: 1,
        daily_rate: costume.daily_rate,
        damage_deposit: costume.damage_deposit
      });
    }
  };

  const addCostumeToList = () => {
    if (!newCostume.costume_id) {
      alert('请选择服装');
      return;
    }
    setFormData({
      ...formData,
      costume_list: [...formData.costume_list, { ...newCostume }]
    });
    setNewCostume({
      costume_id: '',
      costume_name: '',
      quantity: 1,
      daily_rate: 0,
      damage_deposit: 0
    });
  };

  const removeCostumeFromList = (index) => {
    const newList = [...formData.costume_list];
    newList.splice(index, 1);
    setFormData({ ...formData, costume_list: newList });
  };

  const handleSubmit = async () => {
    if (!formData.troupe_id || !formData.name || !formData.start_date || formData.costume_list.length === 0) {
      alert('请填写必填项并添加至少一套服装');
      return;
    }
    try {
      const data = {
        ...formData,
        costume_list: JSON.stringify(formData.costume_list)
      };
      
      if (editingItem) {
        await cycleRuleApi.update(editingItem.id, data);
      } else {
        await cycleRuleApi.create(data);
      }
      setModalVisible(false);
      loadRules();
    } catch (error) {
      alert(error.response?.data?.error || '保存失败');
    }
  };

  const getCycleTypeText = (type) => {
    const map = {
      daily: '每日',
      weekly: '每周',
      monthly: '每月'
    };
    return map[type] || type;
  };

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">周期生成</h2>
        <button className="btn btn-primary" onClick={handleAdd}>
          + 新增周期规则
        </button>
      </div>

      <div className="card">
        <p style={{ marginBottom: '16px', color: '#8c8c8c' }}>
          为固定合作的剧团设置周期性排期规则，可一键批量生成排期
        </p>

        {loading ? (
          <div>加载中...</div>
        ) : rules.length === 0 ? (
          <div className="empty">暂无周期规则</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>规则名称</th>
                <th>合作剧团</th>
                <th>周期类型</th>
                <th>周期时间</th>
                <th>开始日期</th>
                <th>结束日期</th>
                <th>服装数量</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(rule => (
                <tr key={rule.id}>
                  <td>{rule.name}</td>
                  <td>{rule.troupe_name}</td>
                  <td>{getCycleTypeText(rule.cycle_type)}</td>
                  <td>
                    {rule.cycle_type === 'weekly' && `周${['日', '一', '二', '三', '四', '五', '六'][rule.day_of_week]}`}
                    {rule.cycle_type === 'monthly' && `每月${rule.day_of_month}号`}
                    {rule.cycle_type === 'daily' && '每天'}
                  </td>
                  <td>{dayjs(rule.start_date).format('YYYY-MM-DD')}</td>
                  <td>{rule.end_date ? dayjs(rule.end_date).format('YYYY-MM-DD') : '长期'}</td>
                  <td>{rule.costume_list_parsed?.length || 0} 套</td>
                  <td>
                    {rule.status === 'active' ? (
                      <span className="tag tag-green">启用</span>
                    ) : (
                      <span className="tag tag-gray">停用</span>
                    )}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-success btn-sm" onClick={() => handleGenerate(rule)}>
                        生成排期
                      </button>
                      <button className="btn btn-default btn-sm" onClick={() => handleEdit(rule)}>
                        编辑
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(rule)}>
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        title={editingItem ? '编辑周期规则' : '新增周期规则'}
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        size="large"
        footer={
          <>
            <button className="btn btn-default" onClick={() => setModalVisible(false)}>取消</button>
            <button className="btn btn-primary" onClick={handleSubmit}>保存</button>
          </>
        }
      >
        <div className="form-row">
          <div className="form-item">
            <label className="form-label">合作剧团 *</label>
            <select
              className="form-input"
              value={formData.troupe_id}
              onChange={e => setFormData({ ...formData, troupe_id: e.target.value })}
            >
              <option value="">请选择剧团</option>
              {troupes.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="form-item">
            <label className="form-label">规则名称 *</label>
            <input
              type="text"
              className="form-input"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="如：周三固定演出"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-item">
            <label className="form-label">周期类型 *</label>
            <select
              className="form-input"
              value={formData.cycle_type}
              onChange={e => setFormData({ ...formData, cycle_type: e.target.value })}
            >
              <option value="daily">每日</option>
              <option value="weekly">每周</option>
              <option value="monthly">每月</option>
            </select>
          </div>
          <div className="form-item">
            <label className="form-label">
              {formData.cycle_type === 'weekly' ? '周几 *' : formData.cycle_type === 'monthly' ? '几号 *' : '租赁天数 *'}
            </label>
            {formData.cycle_type === 'weekly' ? (
              <select
                className="form-input"
                value={formData.day_of_week}
                onChange={e => setFormData({ ...formData, day_of_week: parseInt(e.target.value) })}
              >
                {['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            ) : formData.cycle_type === 'monthly' ? (
              <input
                type="number"
                className="form-input"
                min="1"
                max="31"
                value={formData.day_of_month}
                onChange={e => setFormData({ ...formData, day_of_month: parseInt(e.target.value) || 1 })}
              />
            ) : (
              <input
                type="number"
                className="form-input"
                value={formData.rental_days}
                onChange={e => setFormData({ ...formData, rental_days: parseInt(e.target.value) || 1 })}
              />
            )}
          </div>
        </div>

        <div className="form-row">
          <div className="form-item">
            <label className="form-label">开始日期 *</label>
            <input
              type="date"
              className="form-input"
              value={formData.start_date}
              onChange={e => setFormData({ ...formData, start_date: e.target.value })}
            />
          </div>
          <div className="form-item">
            <label className="form-label">结束日期</label>
            <input
              type="date"
              className="form-input"
              value={formData.end_date}
              onChange={e => setFormData({ ...formData, end_date: e.target.value })}
            />
          </div>
        </div>

        {formData.cycle_type !== 'daily' && (
          <div className="form-item">
            <label className="form-label">每次租赁天数</label>
            <input
              type="number"
              className="form-input"
              value={formData.rental_days}
              onChange={e => setFormData({ ...formData, rental_days: parseInt(e.target.value) || 1 })}
            />
          </div>
        )}

        <div className="divider"></div>
        <h4 style={{ marginBottom: '12px' }}>服装清单 *</h4>
        
        <div className="form-row" style={{ alignItems: 'flex-end' }}>
          <div className="form-item" style={{ flex: 2 }}>
            <label className="form-label">选择服装</label>
            <select
              className="form-input"
              value={newCostume.costume_id}
              onChange={e => handleCostumeSelect(e.target.value)}
            >
              <option value="">请选择服装</option>
              {costumes.map(c => (
                <option key={c.id} value={c.id}>{c.name} - ¥{c.daily_rate}/天</option>
              ))}
            </select>
          </div>
          <div className="form-item">
            <label className="form-label">数量</label>
            <input
              type="number"
              className="form-input"
              min="1"
              value={newCostume.quantity}
              onChange={e => setNewCostume({ ...newCostume, quantity: parseInt(e.target.value) || 1 })}
            />
          </div>
          <div className="form-item">
            <button className="btn btn-primary" onClick={addCostumeToList} type="button">
              + 添加
            </button>
          </div>
        </div>

        {formData.costume_list.length > 0 ? (
          <table className="table" style={{ marginTop: '12px' }}>
            <thead>
              <tr>
                <th>服装名称</th>
                <th>数量</th>
                <th>日租金</th>
                <th>押金</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {formData.costume_list.map((item, index) => (
                <tr key={index}>
                  <td>{item.costume_name}</td>
                  <td>{item.quantity}</td>
                  <td>¥{item.daily_rate}</td>
                  <td>¥{item.damage_deposit}</td>
                  <td>
                    <button 
                      className="btn btn-danger btn-sm"
                      onClick={() => removeCostumeFromList(index)}
                    >
                      移除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty" style={{ padding: '20px' }}>还未添加服装</div>
        )}
      </Modal>

      <Modal
        title="批量生成排期"
        visible={generateModalVisible}
        onClose={() => setGenerateModalVisible(false)}
        footer={
          <>
            <button className="btn btn-default" onClick={() => setGenerateModalVisible(false)}>取消</button>
            <button className="btn btn-primary" onClick={doGenerate}>生成</button>
          </>
        }
      >
        {generatingRule && (
          <>
            <div className="confirmation-text">
              将为规则 <strong>{generatingRule.name}</strong> 生成排期
            </div>
            <div className="form-item">
              <label className="form-label">生成开始日期</label>
              <input
                type="date"
                className="form-input"
                value={generateStart}
                onChange={e => setGenerateStart(e.target.value)}
              />
            </div>
            <div className="form-item">
              <label className="form-label">生成结束日期</label>
              <input
                type="date"
                className="form-input"
                value={generateEnd}
                onChange={e => setGenerateEnd(e.target.value)}
              />
            </div>
            <div className="confirmation-text" style={{ background: '#f6ffed', padding: '12px', borderRadius: '4px' }}>
              <strong>周期类型：</strong>{getCycleTypeText(generatingRule.cycle_type)}
              {generatingRule.cycle_type === 'weekly' && ` (周${['日', '一', '二', '三', '四', '五', '六'][generatingRule.day_of_week]})`}
              {generatingRule.cycle_type === 'monthly' && ` (每月${generatingRule.day_of_month}号)`}
              <br />
              <strong>包含服装：</strong>{generatingRule.costume_list_parsed?.length || 0} 套
              <br />
              <strong>每次租期：</strong>{generatingRule.rental_days} 天
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

export default CycleRules;
