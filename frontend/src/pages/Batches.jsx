import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { batchApi, costumeApi } from '../api';
import Modal from '../components/Modal';

function Batches() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [costumes, setCostumes] = useState([]);
  const [costumeFilter, setCostumeFilter] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    costume_id: '',
    batch_no: '',
    quantity: 0,
    expiry_date: '',
    purchase_price: 0,
    supplier: '',
    remark: ''
  });

  useEffect(() => {
    loadBatches();
    loadCostumes();
  }, []);

  useEffect(() => {
    loadBatches();
  }, [activeTab]);

  const loadBatches = async () => {
    try {
      setLoading(true);
      let params = {};
      if (keyword) params.keyword = keyword;
      if (costumeFilter) params.costume_id = costumeFilter;
      if (status) params.status = status;
      
      const res = await batchApi.list(params);
      let data = res.data;
      
      if (activeTab === 'warning') {
        data = data.filter(b => b.expiry_status === 'warning' || b.expiry_status === 'expired');
      } else if (activeTab === 'locked') {
        data = data.filter(b => b.status === 'locked');
      } else if (activeTab === 'expired') {
        data = data.filter(b => b.expiry_status === 'expired');
      }
      
      setBatches(data);
    } catch (error) {
      alert('加载失败');
    } finally {
      setLoading(false);
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

  const handleSearch = () => {
    loadBatches();
  };

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({
      costume_id: '',
      batch_no: '',
      quantity: 0,
      expiry_date: '',
      purchase_price: 0,
      supplier: '',
      remark: ''
    });
    setModalVisible(true);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      costume_id: item.costume_id,
      batch_no: item.batch_no,
      quantity: item.quantity,
      expiry_date: item.expiry_date,
      purchase_price: item.purchase_price,
      supplier: item.supplier || '',
      remark: item.remark || ''
    });
    setModalVisible(true);
  };

  const handleDelete = async (item) => {
    if (!confirm(`确定删除批次"${item.batch_no}"吗？`)) return;
    try {
      await batchApi.delete(item.id);
      loadBatches();
    } catch (error) {
      alert('删除失败');
    }
  };

  const handleLock = async (item) => {
    if (!confirm(`确定锁定批次"${item.batch_no}"吗？锁定后将无法出库。`)) return;
    try {
      await batchApi.lock(item.id);
      loadBatches();
    } catch (error) {
      alert('操作失败');
    }
  };

  const handleUnlock = async (item) => {
    if (!confirm(`确定解锁批次"${item.batch_no}"吗？`)) return;
    try {
      await batchApi.unlock(item.id);
      loadBatches();
    } catch (error) {
      alert('操作失败');
    }
  };

  const handleSubmit = async () => {
    if (!formData.costume_id || !formData.batch_no || !formData.quantity || !formData.expiry_date) {
      alert('请填写必填项');
      return;
    }
    try {
      if (editingItem) {
        await batchApi.update(editingItem.id, formData);
      } else {
        await batchApi.create(formData);
      }
      setModalVisible(false);
      loadBatches();
    } catch (error) {
      alert(error.response?.data?.error || '保存失败');
    }
  };

  const getStatusTag = (batch) => {
    if (batch.status === 'locked') {
      return <span className="tag tag-gray">已锁定</span>;
    }
    if (batch.expiry_status === 'expired') {
      return <span className="tag tag-red">已过期</span>;
    }
    if (batch.expiry_status === 'warning') {
      return <span className="tag tag-orange">临期 {batch.days_to_expiry}天</span>;
    }
    return <span className="tag tag-green">正常</span>;
  };

  const warningCount = batches.filter(b => b.expiry_status === 'warning').length;
  const expiredCount = batches.filter(b => b.expiry_status === 'expired').length;
  const lockedCount = batches.filter(b => b.status === 'locked').length;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">批次管理</h2>
        <button className="btn btn-primary" onClick={handleAdd}>
          + 新增批次
        </button>
      </div>

      <div className="card">
        <div className="tabs">
          <div 
            className={`tab-item ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            全部
          </div>
          <div 
            className={`tab-item ${activeTab === 'warning' ? 'active' : ''}`}
            onClick={() => setActiveTab('warning')}
          >
            临期预警
            {warningCount > 0 && (
              <span className="tag tag-orange" style={{ marginLeft: '8px' }}>{warningCount}</span>
            )}
          </div>
          <div 
            className={`tab-item ${activeTab === 'expired' ? 'active' : ''}`}
            onClick={() => setActiveTab('expired')}
          >
            已过期
            {expiredCount > 0 && (
              <span className="tag tag-red" style={{ marginLeft: '8px' }}>{expiredCount}</span>
            )}
          </div>
          <div 
            className={`tab-item ${activeTab === 'locked' ? 'active' : ''}`}
            onClick={() => setActiveTab('locked')}
          >
            已锁定
            {lockedCount > 0 && (
              <span className="tag tag-gray" style={{ marginLeft: '8px' }}>{lockedCount}</span>
            )}
          </div>
        </div>

        <div className="search-bar">
          <div className="form-item">
            <input
              type="text"
              className="form-input"
              placeholder="搜索批次号/服装名"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
            />
          </div>
          <div className="form-item">
            <select
              className="form-input"
              value={costumeFilter}
              onChange={e => setCostumeFilter(e.target.value)}
            >
              <option value="">全部服装</option>
              {costumes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="form-item">
            <select
              className="form-input"
              value={status}
              onChange={e => setStatus(e.target.value)}
            >
              <option value="">全部状态</option>
              <option value="normal">正常</option>
              <option value="locked">已锁定</option>
              <option value="expired">已过期</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={handleSearch}>搜索</button>
        </div>

        {loading ? (
          <div>加载中...</div>
        ) : batches.length === 0 ? (
          <div className="empty">暂无批次数据</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>批次号</th>
                <th>服装名称</th>
                <th>类别</th>
                <th>总数量</th>
                <th>可用数量</th>
                <th>效期</th>
                <th>状态</th>
                <th>供应商</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {batches.map(batch => (
                <tr key={batch.id}>
                  <td>{batch.batch_no}</td>
                  <td>{batch.costume_name}</td>
                  <td>{batch.costume_category}</td>
                  <td>{batch.quantity}</td>
                  <td>{batch.available_quantity}</td>
                  <td style={{ color: batch.days_to_expiry <= 30 ? '#ff4d4f' : '' }}>
                    {dayjs(batch.expiry_date).format('YYYY-MM-DD')}
                    <br />
                    <span style={{ fontSize: '12px', color: '#8c8c8c' }}>
                      {batch.days_to_expiry > 0 ? `剩余 ${batch.days_to_expiry} 天` : `已过期 ${Math.abs(batch.days_to_expiry)} 天`}
                    </span>
                  </td>
                  <td>{getStatusTag(batch)}</td>
                  <td>{batch.supplier || '-'}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-default btn-sm" onClick={() => handleEdit(batch)}>
                        编辑
                      </button>
                      {batch.status === 'locked' ? (
                        <button className="btn btn-success btn-sm" onClick={() => handleUnlock(batch)}>
                          解锁
                        </button>
                      ) : (
                        <button className="btn btn-warning btn-sm" onClick={() => handleLock(batch)}>
                          锁定
                        </button>
                      )}
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(batch)}>
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
        title={editingItem ? '编辑批次' : '新增批次（入库）'}
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
          <label className="form-label">选择服装 *</label>
          <select
            className="form-input"
            value={formData.costume_id}
            onChange={e => setFormData({ ...formData, costume_id: e.target.value })}
          >
            <option value="">请选择服装</option>
            {costumes.map(c => (
              <option key={c.id} value={c.id}>{c.name} - ¥{c.daily_rate}/天</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <div className="form-item">
            <label className="form-label">批次号 *</label>
            <input
              type="text"
              className="form-input"
              value={formData.batch_no}
              onChange={e => setFormData({ ...formData, batch_no: e.target.value })}
              placeholder="如：BATCH-20240101-001"
            />
          </div>
          <div className="form-item">
            <label className="form-label">数量 *</label>
            <input
              type="number"
              className="form-input"
              value={formData.quantity}
              onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-item">
            <label className="form-label">效期 *</label>
            <input
              type="date"
              className="form-input"
              value={formData.expiry_date}
              onChange={e => setFormData({ ...formData, expiry_date: e.target.value })}
            />
          </div>
          <div className="form-item">
            <label className="form-label">采购单价 (元)</label>
            <input
              type="number"
              className="form-input"
              value={formData.purchase_price}
              onChange={e => setFormData({ ...formData, purchase_price: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>
        <div className="form-item">
          <label className="form-label">供应商</label>
          <input
            type="text"
            className="form-input"
            value={formData.supplier}
            onChange={e => setFormData({ ...formData, supplier: e.target.value })}
          />
        </div>
        <div className="form-item">
          <label className="form-label">备注</label>
          <textarea
            className="form-input form-textarea"
            value={formData.remark}
            onChange={e => setFormData({ ...formData, remark: e.target.value })}
          />
        </div>
      </Modal>
    </div>
  );
}

export default Batches;
