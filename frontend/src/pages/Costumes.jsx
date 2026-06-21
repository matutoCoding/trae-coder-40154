import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { costumeApi } from '../api';
import Modal from '../components/Modal';

function Costumes() {
  const [costumes, setCostumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    size: '',
    color: '',
    description: '',
    daily_rate: 0,
    damage_deposit: 0
  });

  useEffect(() => {
    loadCostumes();
    loadCategories();
  }, []);

  const loadCostumes = async () => {
    try {
      setLoading(true);
      const res = await costumeApi.list({ keyword, category });
      setCostumes(res.data);
    } catch (error) {
      alert('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await costumeApi.categories();
      setCategories(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSearch = () => {
    loadCostumes();
  };

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      category: '',
      size: '',
      color: '',
      description: '',
      daily_rate: 0,
      damage_deposit: 0
    });
    setModalVisible(true);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      size: item.size || '',
      color: item.color || '',
      description: item.description || '',
      daily_rate: item.daily_rate,
      damage_deposit: item.damage_deposit
    });
    setModalVisible(true);
  };

  const handleView = async (item) => {
    try {
      const res = await costumeApi.get(item.id);
      setDetailItem(res.data);
      setDetailVisible(true);
    } catch (error) {
      alert('加载详情失败');
    }
  };

  const handleDelete = async (item) => {
    if (!confirm(`确定删除服装"${item.name}"吗？`)) return;
    try {
      await costumeApi.delete(item.id);
      loadCostumes();
    } catch (error) {
      alert('删除失败');
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.category) {
      alert('请填写服装名称和类别');
      return;
    }
    try {
      if (editingItem) {
        await costumeApi.update(editingItem.id, formData);
      } else {
        await costumeApi.create(formData);
      }
      setModalVisible(false);
      loadCostumes();
      loadCategories();
    } catch (error) {
      alert('保存失败');
    }
  };

  const getExpiryStatusTag = (costume) => {
    if (!costume.nearest_expiry) return <span className="tag tag-gray">无库存</span>;
    if (costume.expiry_status === 'expired') {
      return <span className="tag tag-red">已过期</span>;
    }
    if (costume.expiry_status === 'warning') {
      return <span className="tag tag-orange">临期 {costume.days_to_expiry}天</span>;
    }
    return <span className="tag tag-green">正常</span>;
  };

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">服装建档</h2>
        <button className="btn btn-primary" onClick={handleAdd}>
          + 新增服装
        </button>
      </div>

      <div className="card">
        <div className="search-bar">
          <div className="form-item">
            <input
              type="text"
              className="form-input"
              placeholder="搜索服装名称"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
            />
          </div>
          <div className="form-item">
            <select
              className="form-input"
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              <option value="">全部类别</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" onClick={handleSearch}>搜索</button>
        </div>

        {loading ? (
          <div>加载中...</div>
        ) : costumes.length === 0 ? (
          <div className="empty">暂无服装数据</div>
        ) : (
          <div className="costume-grid">
            {costumes.map(costume => (
              <div
                key={costume.id}
                className="costume-card"
                onClick={() => handleView(costume)}
              >
                <div className="costume-card-header">
                  <div className="costume-card-title">{costume.name}</div>
                  {getExpiryStatusTag(costume)}
                </div>
                <div className="costume-card-meta">
                  <span className="tag tag-blue">{costume.category}</span>
                  {costume.size && <span className="tag tag-gray">{costume.size}</span>}
                  {costume.color && <span className="tag tag-gray">{costume.color}</span>}
                </div>
                <p style={{ color: '#8c8c8c', fontSize: '13px', marginBottom: '12px' }}>
                  {costume.description || '暂无描述'}
                </p>
                <div className="costume-card-footer">
                  <div>
                    <span style={{ color: '#8c8c8c', fontSize: '13px' }}>日租金</span>
                    <div style={{ color: '#ff4d4f', fontSize: '18px', fontWeight: '600' }}>
                      ¥{costume.daily_rate}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ color: '#8c8c8c', fontSize: '13px' }}>库存</span>
                    <div style={{ fontSize: '18px', fontWeight: '600' }}>
                      {costume.available_quantity || 0}/{costume.total_quantity || 0}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        title={editingItem ? '编辑服装' : '新增服装'}
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        footer={
          <>
            <button className="btn btn-default" onClick={() => setModalVisible(false)}>取消</button>
            <button className="btn btn-primary" onClick={handleSubmit}>保存</button>
          </>
        }
      >
        <div className="form-item">
          <label className="form-label">服装名称 *</label>
          <input
            type="text"
            className="form-input"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
          />
        </div>
        <div className="form-row">
          <div className="form-item">
            <label className="form-label">类别 *</label>
            <input
              type="text"
              className="form-input"
              value={formData.category}
              onChange={e => setFormData({ ...formData, category: e.target.value })}
              placeholder="如：戏曲服、汉服、舞蹈服"
            />
          </div>
          <div className="form-item">
            <label className="form-label">尺码</label>
            <input
              type="text"
              className="form-input"
              value={formData.size}
              onChange={e => setFormData({ ...formData, size: e.target.value })}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-item">
            <label className="form-label">颜色</label>
            <input
              type="text"
              className="form-input"
              value={formData.color}
              onChange={e => setFormData({ ...formData, color: e.target.value })}
            />
          </div>
          <div className="form-item">
            <label className="form-label">日租金 (元)</label>
            <input
              type="number"
              className="form-input"
              value={formData.daily_rate}
              onChange={e => setFormData({ ...formData, daily_rate: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>
        <div className="form-item">
          <label className="form-label">破损押金 (元)</label>
          <input
            type="number"
            className="form-input"
            value={formData.damage_deposit}
            onChange={e => setFormData({ ...formData, damage_deposit: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div className="form-item">
          <label className="form-label">描述</label>
          <textarea
            className="form-input form-textarea"
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
          />
        </div>
      </Modal>

      <Modal
        title="服装详情"
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        size="large"
        footer={
          <button className="btn btn-default" onClick={() => setDetailVisible(false)}>关闭</button>
        }
      >
        {detailItem && (
          <>
            <div className="detail-row">
              <span className="detail-label">服装名称：</span>
              <span className="detail-value">{detailItem.name}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">类别：</span>
              <span className="detail-value">{detailItem.category}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">尺码/颜色：</span>
              <span className="detail-value">{detailItem.size || '-'} / {detailItem.color || '-'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">日租金：</span>
              <span className="detail-value" style={{ color: '#ff4d4f' }}>¥{detailItem.daily_rate}/天</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">破损押金：</span>
              <span className="detail-value">¥{detailItem.damage_deposit}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">描述：</span>
              <span className="detail-value">{detailItem.description || '-'}</span>
            </div>

            <div className="divider"></div>
            <h4 style={{ marginBottom: '12px' }}>批次列表</h4>
            {detailItem.batches?.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>批次号</th>
                    <th>数量</th>
                    <th>可用</th>
                    <th>效期</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {detailItem.batches.map(batch => (
                    <tr key={batch.id}>
                      <td>{batch.batch_no}</td>
                      <td>{batch.quantity}</td>
                      <td>{batch.available_quantity}</td>
                      <td>{dayjs(batch.expiry_date).format('YYYY-MM-DD')}</td>
                      <td>
                        {batch.expiry_status === 'expired' ? (
                          <span className="tag tag-red">已过期</span>
                        ) : batch.expiry_status === 'warning' ? (
                          <span className="tag tag-orange">临期 {batch.days_to_expiry}天</span>
                        ) : (
                          <span className="tag tag-green">正常</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty">暂无批次</div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}

export default Costumes;
