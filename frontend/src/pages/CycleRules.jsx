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
  const [generateEnd, setGenerateEnd] = useState(dayjs().add(1, 'month').format('YYYY-MM-DD'));
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewStep, setPreviewStep] = useState(1);
  
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
    setGenerateEnd(dayjs().add(1, 'month').format('YYYY-MM-DD'));
    setPreviewData(null);
    setPreviewStep(1);
    setGenerateModalVisible(true);
  };

  const doPreview = async () => {
    if (!generatingRule) return;
    if (dayjs(generateEnd).isBefore(dayjs(generateStart))) {
      alert('结束日期不能早于开始日期');
      return;
    }
    try {
      setPreviewLoading(true);
      const res = await cycleRuleApi.preview(generatingRule.id, {
        start_date: generateStart,
        end_date: generateEnd
      });
      setPreviewData(res.data);
      setPreviewStep(2);
    } catch (error) {
      alert(error.response?.data?.error || '预览失败');
    } finally {
      setPreviewLoading(false);
    }
  };

  const togglePreviewItem = (key) => {
    if (!previewData) return;
    const newItems = previewData.preview_items.map(item => {
      if (item.key === key) {
        if (!item.stock_ok) return item;
        return { ...item, selected: !item.selected };
      }
      return item;
    });
    setPreviewData({ ...previewData, preview_items: newItems });
  };

  const toggleAllStockOk = () => {
    if (!previewData) return;
    const hasUnselected = previewData.preview_items.some(i => i.stock_ok && !i.selected);
    const newItems = previewData.preview_items.map(item => {
      if (item.stock_ok) {
        return { ...item, selected: hasUnselected };
      }
      return item;
    });
    setPreviewData({ ...previewData, preview_items: newItems });
  };

  const doGenerate = async () => {
    if (!generatingRule || !previewData) return;
    const selectedItems = previewData.preview_items.filter(i => i.selected && i.stock_ok);
    if (selectedItems.length === 0) {
      alert('请至少选择一条可生成的排期');
      return;
    }
    if (!confirm(`确定生成 ${selectedItems.length} 条排期吗？`)) return;
    try {
      const res = await cycleRuleApi.generate(generatingRule.id, {
        selected_items: selectedItems
      });
      alert(res.data.message);
      setGenerateModalVisible(false);
    } catch (error) {
      alert(error.response?.data?.error || '生成失败');
    }
  };

  const backToDateSelect = () => {
    setPreviewStep(1);
    setPreviewData(null);
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
        size="extraLarge"
        footer={
          previewStep === 1 ? (
            <>
              <button className="btn btn-default" onClick={() => setGenerateModalVisible(false)}>取消</button>
              <button className="btn btn-primary" onClick={doPreview} disabled={previewLoading}>
                {previewLoading ? '加载中...' : '下一步：预览库存'}
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-default" onClick={backToDateSelect}>上一步</button>
              <button className="btn btn-default" onClick={() => setGenerateModalVisible(false)}>取消</button>
              <button className="btn btn-primary" onClick={doGenerate}>
                确认生成 {previewData?.preview_items?.filter(i => i.selected && i.stock_ok).length || 0} 条
              </button>
            </>
          )
        }
      >
        {generatingRule && previewStep === 1 && (
          <>
            <div className="confirmation-text" style={{ background: '#e6f7ff', padding: '12px', borderRadius: '4px', marginBottom: '16px' }}>
              将为规则 <strong>{generatingRule.name}</strong> 生成排期
            </div>
            <div className="form-row">
              <div className="form-item">
                <label className="form-label">生成开始日期 *</label>
                <input
                  type="date"
                  className="form-input"
                  value={generateStart}
                  onChange={e => setGenerateStart(e.target.value)}
                />
              </div>
              <div className="form-item">
                <label className="form-label">生成结束日期 *</label>
                <input
                  type="date"
                  className="form-input"
                  value={generateEnd}
                  onChange={e => setGenerateEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="confirmation-text" style={{ background: '#f6ffed', padding: '12px', borderRadius: '4px' }}>
              <strong>剧团：</strong>{generatingRule.troupe_name}<br />
              <strong>周期类型：</strong>{getCycleTypeText(generatingRule.cycle_type)}
              {generatingRule.cycle_type === 'weekly' && ` (周${['日', '一', '二', '三', '四', '五', '六'][generatingRule.day_of_week]})`}
              {generatingRule.cycle_type === 'monthly' && ` (每月${generatingRule.day_of_month}号)`}
              <br />
              <strong>包含服装：</strong>{generatingRule.costume_list_parsed?.length || 0} 套
              <strong style={{ marginLeft: '20px' }}>每次租期：</strong>{generatingRule.rental_days} 天
            </div>
          </>
        )}

        {generatingRule && previewStep === 2 && previewData && (
          <>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px'
            }}>
              <div style={{ padding: '12px', background: '#e6f7ff', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#1890ff' }}>{previewData.total_items}</div>
                <div style={{ fontSize: '12px', color: '#8c8c8c' }}>总排期数</div>
              </div>
              <div style={{ padding: '12px', background: '#f6ffed', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#52c41a' }}>{previewData.all_ok_count}</div>
                <div style={{ fontSize: '12px', color: '#8c8c8c' }}>库存充足</div>
              </div>
              <div style={{ padding: '12px', background: '#fff7e6', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#fa8c16' }}>{previewData.insufficient_count}</div>
                <div style={{ fontSize: '12px', color: '#8c8c8c' }}>库存不足(跳过)</div>
              </div>
              <div style={{ padding: '12px', background: '#f9f0ff', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#722ed1' }}>{previewData.preview_items.filter(i => i.selected && i.stock_ok).length}</div>
                <div style={{ fontSize: '12px', color: '#8c8c8c' }}>已勾选将生成</div>
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <button className="btn btn-default btn-sm" onClick={toggleAllStockOk}>
                {previewData.preview_items.some(i => i.stock_ok && !i.selected) ? '全选库存充足项' : '取消全选'}
              </button>
            </div>

            <div style={{ maxHeight: '450px', overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: '4px' }}>
              <table className="table" style={{ margin: 0 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    <th style={{ width: '40px' }}>
                      <input type="checkbox" 
                        checked={previewData.preview_items.every(i => !i.stock_ok || i.selected)}
                        onChange={toggleAllStockOk}
                        disabled={previewData.preview_items.every(i => !i.stock_ok)}
                      />
                    </th>
                    <th>起租日期</th>
                    <th>归还日期</th>
                    <th>服装</th>
                    <th>数量</th>
                    <th>日租金</th>
                    <th>总金额</th>
                    <th>库存情况</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.preview_items.map(item => (
                    <tr key={item.key} style={{ background: !item.stock_ok ? '#fff1f0' : 'white' }}>
                      <td>
                        <input
                          type="checkbox"
                          checked={item.selected && item.stock_ok}
                          disabled={!item.stock_ok}
                          onChange={() => togglePreviewItem(item.key)}
                        />
                      </td>
                      <td>{item.start_date}</td>
                      <td>{item.end_date}</td>
                      <td>{item.costume_name}</td>
                      <td>{item.quantity}</td>
                      <td>¥{item.daily_rate}</td>
                      <td style={{ color: '#ff4d4f', fontWeight: 600 }}>¥{item.total_amount}</td>
                      <td>
                        {item.stock_ok ? (
                          <span className="tag tag-green">
                            可用 (净余: {item.net_available}/{item.total_available})
                          </span>
                        ) : (
                          <span className="tag tag-red">
                            不足 (净余: {item.net_available}/{item.total_available}, 占用: {item.already_reserved + item.accumulated_reserved})
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '12px', fontSize: '13px', color: '#8c8c8c' }}>
              💡 提示：<span style={{ color: '#fa8c16' }}>红色背景</span>的行表示库存不足，将无法勾选，生成时会自动跳过。您可以根据实际情况调整日期范围或服装数量。
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

export default CycleRules;
