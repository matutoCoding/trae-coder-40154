import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { troupeApi } from '../api';
import Modal from '../components/Modal';

function Troupes() {
  const [troupes, setTroupes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [isCooperative, setIsCooperative] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    address: '',
    is_cooperative: false,
    remark: ''
  });

  useEffect(() => {
    loadTroupes();
  }, []);

  const loadTroupes = async () => {
    try {
      setLoading(true);
      let params = {};
      if (keyword) params.keyword = keyword;
      if (isCooperative !== '') params.is_cooperative = isCooperative;
      const res = await troupeApi.list(params);
      setTroupes(res.data);
    } catch (error) {
      alert('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadTroupes();
  };

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      contact_person: '',
      phone: '',
      address: '',
      is_cooperative: false,
      remark: ''
    });
    setModalVisible(true);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      contact_person: item.contact_person || '',
      phone: item.phone || '',
      address: item.address || '',
      is_cooperative: !!item.is_cooperative,
      remark: item.remark || ''
    });
    setModalVisible(true);
  };

  const handleView = async (item) => {
    try {
      const res = await troupeApi.get(item.id);
      setDetailItem(res.data);
      setDetailVisible(true);
    } catch (error) {
      alert('加载详情失败');
    }
  };

  const handleDelete = async (item) => {
    if (!confirm(`确定删除剧团"${item.name}"吗？`)) return;
    try {
      await troupeApi.delete(item.id);
      loadTroupes();
    } catch (error) {
      alert('删除失败');
    }
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      alert('请填写剧团名称');
      return;
    }
    try {
      if (editingItem) {
        await troupeApi.update(editingItem.id, formData);
      } else {
        await troupeApi.create(formData);
      }
      setModalVisible(false);
      loadTroupes();
    } catch (error) {
      alert('保存失败');
    }
  };

  const cooperativeCount = troupes.filter(t => t.is_cooperative).length;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">剧团管理</h2>
        <button className="btn btn-primary" onClick={handleAdd}>
          + 新增剧团
        </button>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-icon purple">🎭</div>
          <div className="stat-title">剧团总数</div>
          <div className="stat-value">{troupes.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">⭐</div>
          <div className="stat-title">合作剧团</div>
          <div className="stat-value">{cooperativeCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue">📋</div>
          <div className="stat-title">普通剧团</div>
          <div className="stat-value">{troupes.length - cooperativeCount}</div>
        </div>
      </div>

      <div className="card">
        <div className="search-bar">
          <div className="form-item">
            <input
              type="text"
              className="form-input"
              placeholder="搜索名称/联系人/电话"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
            />
          </div>
          <div className="form-item">
            <select
              className="form-input"
              value={isCooperative}
              onChange={e => setIsCooperative(e.target.value)}
            >
              <option value="">全部类型</option>
              <option value="1">固定合作</option>
              <option value="0">普通客户</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={handleSearch}>搜索</button>
        </div>

        {loading ? (
          <div>加载中...</div>
        ) : troupes.length === 0 ? (
          <div className="empty">暂无剧团数据</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>剧团名称</th>
                <th>联系人</th>
                <th>联系电话</th>
                <th>地址</th>
                <th>类型</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {troupes.map(troupe => (
                <tr key={troupe.id}>
                  <td>{troupe.name}</td>
                  <td>{troupe.contact_person || '-'}</td>
                  <td>{troupe.phone || '-'}</td>
                  <td>{troupe.address || '-'}</td>
                  <td>
                    {troupe.is_cooperative ? (
                      <span className="tag tag-green">固定合作</span>
                    ) : (
                      <span className="tag tag-gray">普通客户</span>
                    )}
                  </td>
                  <td>{dayjs(troupe.created_at).format('YYYY-MM-DD')}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-default btn-sm" onClick={() => handleView(troupe)}>详情</button>
                      <button className="btn btn-default btn-sm" onClick={() => handleEdit(troupe)}>编辑</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(troupe)}>删除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        title={editingItem ? '编辑剧团' : '新增剧团'}
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
          <label className="form-label">剧团名称 *</label>
          <input
            type="text"
            className="form-input"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
          />
        </div>
        <div className="form-row">
          <div className="form-item">
            <label className="form-label">联系人</label>
            <input
              type="text"
              className="form-input"
              value={formData.contact_person}
              onChange={e => setFormData({ ...formData, contact_person: e.target.value })}
            />
          </div>
          <div className="form-item">
            <label className="form-label">联系电话</label>
            <input
              type="text"
              className="form-input"
              value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
        </div>
        <div className="form-item">
          <label className="form-label">地址</label>
          <input
            type="text"
            className="form-input"
            value={formData.address}
            onChange={e => setFormData({ ...formData, address: e.target.value })}
          />
        </div>
        <div className="form-item">
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={formData.is_cooperative}
              onChange={e => setFormData({ ...formData, is_cooperative: e.target.checked })}
            />
            <span className="form-label" style={{ marginBottom: 0 }}>固定合作剧团</span>
          </label>
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

      <Modal
        title="剧团详情"
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
              <span className="detail-label">剧团名称：</span>
              <span className="detail-value">{detailItem.name}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">类型：</span>
              <span className="detail-value">
                {detailItem.is_cooperative ? (
                  <span className="tag tag-green">固定合作</span>
                ) : (
                  <span className="tag tag-gray">普通客户</span>
                )}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">联系人：</span>
              <span className="detail-value">{detailItem.contact_person || '-'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">联系电话：</span>
              <span className="detail-value">{detailItem.phone || '-'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">地址：</span>
              <span className="detail-value">{detailItem.address || '-'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">备注：</span>
              <span className="detail-value">{detailItem.remark || '-'}</span>
            </div>

            <div className="divider"></div>
            <h4 style={{ marginBottom: '12px' }}>关联的周期规则</h4>
            {detailItem.cycle_rules?.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>规则名称</th>
                    <th>周期类型</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {detailItem.cycle_rules.map(rule => (
                    <tr key={rule.id}>
                      <td>{rule.name}</td>
                      <td>{rule.cycle_type === 'weekly' ? '每周' : rule.cycle_type === 'monthly' ? '每月' : '每日'}</td>
                      <td>
                        {rule.status === 'active' ? (
                          <span className="tag tag-green">启用</span>
                        ) : (
                          <span className="tag tag-gray">停用</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty" style={{ padding: '20px' }}>暂无周期规则</div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}

export default Troupes;
