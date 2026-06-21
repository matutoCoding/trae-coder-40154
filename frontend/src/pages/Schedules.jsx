import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { scheduleApi, costumeApi, troupeApi } from '../api';
import Modal from '../components/Modal';

function Schedules() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list');
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [statusFilter, setStatusFilter] = useState('');
  const [troupeFilter, setTroupeFilter] = useState('');
  const [costumeFilter, setCostumeFilter] = useState('');
  const [costumes, setCostumes] = useState([]);
  const [troupes, setTroupes] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [formData, setFormData] = useState({
    troupe_id: '',
    troupe_name: '',
    costume_id: '',
    costume_name: '',
    quantity: 1,
    start_date: '',
    end_date: '',
    rental_days: 1,
    daily_rate: 0,
    damage_deposit: 0,
    contact_person: '',
    phone: '',
    remark: ''
  });

  useEffect(() => {
    loadSchedules();
    loadCostumes();
    loadTroupes();
  }, []);

  useEffect(() => {
    if (viewMode === 'calendar') {
      loadCalendarSchedules();
    }
  }, [currentMonth, viewMode]);

  const loadSchedules = async () => {
    try {
      setLoading(true);
      let params = {};
      if (statusFilter) params.status = statusFilter;
      if (troupeFilter) params.troupe_id = troupeFilter;
      if (costumeFilter) params.costume_id = costumeFilter;
      
      const res = await scheduleApi.list(params);
      setSchedules(res.data);
    } catch (error) {
      alert('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadCalendarSchedules = async () => {
    try {
      const start = currentMonth.startOf('month').format('YYYY-MM-DD');
      const end = currentMonth.endOf('month').format('YYYY-MM-DD');
      const res = await scheduleApi.calendar({ start_date: start, end_date: end });
      setSchedules(res.data);
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

  const loadTroupes = async () => {
    try {
      const res = await troupeApi.list();
      setTroupes(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSearch = () => {
    loadSchedules();
  };

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({
      troupe_id: '',
      troupe_name: '',
      costume_id: '',
      costume_name: '',
      quantity: 1,
      start_date: dayjs().format('YYYY-MM-DD'),
      end_date: dayjs().format('YYYY-MM-DD'),
      rental_days: 1,
      daily_rate: 0,
      damage_deposit: 0,
      contact_person: '',
      phone: '',
      remark: ''
    });
    setModalVisible(true);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      troupe_id: item.troupe_id || '',
      troupe_name: item.troupe_name || '',
      costume_id: item.costume_id,
      costume_name: item.costume_name,
      quantity: item.quantity,
      start_date: item.start_date,
      end_date: item.end_date,
      rental_days: item.rental_days,
      daily_rate: item.daily_rate,
      damage_deposit: item.damage_deposit,
      contact_person: item.contact_person || '',
      phone: item.phone || '',
      remark: item.remark || ''
    });
    setModalVisible(true);
  };

  const handleView = async (item) => {
    try {
      const res = await scheduleApi.get(item.id);
      setDetailItem(res.data);
      setDetailVisible(true);
    } catch (error) {
      alert('加载详情失败');
    }
  };

  const handleDelete = async (item) => {
    if (!confirm('确定删除该排期吗？')) return;
    try {
      await scheduleApi.delete(item.id);
      loadSchedules();
    } catch (error) {
      alert(error.response?.data?.error || '删除失败');
    }
  };

  const handleConfirm = async (item) => {
    if (!confirm('确定确认该排期吗？')) return;
    try {
      await scheduleApi.confirm(item.id);
      loadSchedules();
    } catch (error) {
      alert('操作失败');
    }
  };

  const handleCancel = async (item) => {
    if (!confirm('确定取消该排期吗？')) return;
    try {
      await scheduleApi.cancel(item.id);
      loadSchedules();
    } catch (error) {
      alert(error.response?.data?.error || '操作失败');
    }
  };

  const handleCostumeChange = (costumeId) => {
    const costume = costumes.find(c => c.id == costumeId);
    if (costume) {
      setFormData({
        ...formData,
        costume_id: costumeId,
        costume_name: costume.name,
        daily_rate: costume.daily_rate,
        damage_deposit: costume.damage_deposit
      });
    }
  };

  const handleTroupeChange = (troupeId) => {
    const troupe = troupes.find(t => t.id == troupeId);
    if (troupe) {
      setFormData({
        ...formData,
        troupe_id: troupeId,
        troupe_name: troupe.name,
        contact_person: troupe.contact_person || '',
        phone: troupe.phone || ''
      });
    }
  };

  const handleDateChange = (field, value) => {
    const newData = { ...formData, [field]: value };
    if (newData.start_date && newData.end_date) {
      const days = dayjs(newData.end_date).diff(dayjs(newData.start_date), 'day') + 1;
      newData.rental_days = days;
    }
    setFormData(newData);
  };

  const handleSubmit = async () => {
    if (!formData.costume_id || !formData.quantity || !formData.start_date || !formData.end_date) {
      alert('请填写必填项');
      return;
    }
    
    const qty = parseInt(formData.quantity);
    if (isNaN(qty) || qty <= 0) {
      alert('数量必须大于0');
      return;
    }
    
    if (dayjs(formData.end_date).isBefore(dayjs(formData.start_date), 'day')) {
      alert('归还日期不能早于起租日期');
      return;
    }
    
    try {
      if (editingItem) {
        await scheduleApi.update(editingItem.id, formData);
      } else {
        await scheduleApi.create(formData);
      }
      setModalVisible(false);
      loadSchedules();
    } catch (error) {
      alert(error.response?.data?.error || '保存失败');
    }
  };

  const getStatusTag = (status) => {
    const map = {
      reserved: { text: '已预约', color: 'blue' },
      confirmed: { text: '已确认', color: 'green' },
      outbound: { text: '已出库', color: 'orange' },
      returned: { text: '已归还', color: 'purple' },
      cancelled: { text: '已取消', color: 'gray' }
    };
    const info = map[status] || { text: status, color: 'gray' };
    return <span className={`tag tag-${info.color}`}>{info.text}</span>;
  };

  const renderCalendar = () => {
    const startOfMonth = currentMonth.startOf('month');
    const endOfMonth = currentMonth.endOf('month');
    const startDay = startOfMonth.startOf('week');
    const endDay = endOfMonth.endOf('week');
    
    const days = [];
    let day = startDay;
    while (day.isBefore(endDay) || day.isSame(endDay, 'day')) {
      days.push(day);
      day = day.add(1, 'day');
    }

    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

    const getSchedulesForDate = (date) => {
      const dateStr = date.format('YYYY-MM-DD');
      return schedules.filter(s => 
        (dayjs(s.start_date).isSame(dateStr, 'day') || dayjs(s.start_date).isBefore(dateStr, 'day')) &&
        (dayjs(s.end_date).isSame(dateStr, 'day') || dayjs(s.end_date).isAfter(dateStr, 'day'))
      );
    };

    return (
      <div className="calendar">
        <div className="calendar-header">
          <div className="calendar-nav">
            <button className="btn btn-default btn-sm" onClick={() => setCurrentMonth(currentMonth.subtract(1, 'month'))}>
              ◀
            </button>
            <span className="calendar-title">
              {currentMonth.format('YYYY年 MM月')}
            </span>
            <button className="btn btn-default btn-sm" onClick={() => setCurrentMonth(currentMonth.add(1, 'month'))}>
              ▶
            </button>
          </div>
          <button className="btn btn-primary" onClick={handleAdd}>+ 新增排期</button>
        </div>
        <div className="calendar-grid">
          {weekDays.map(d => (
            <div key={d} className="calendar-day-header">{d}</div>
          ))}
          {days.map((day, idx) => {
            const isToday = day.isSame(dayjs(), 'day');
            const isOtherMonth = day.month() !== currentMonth.month();
            const daySchedules = getSchedulesForDate(day);

            return (
              <div
                key={idx}
                className={`calendar-day ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}`}
              >
                <div className="calendar-day-number">{day.date()}</div>
                {daySchedules.slice(0, 3).map(s => (
                  <div
                    key={s.id}
                    className={`calendar-event ${s.status}`}
                    onClick={() => handleView(s)}
                    title={`${s.costume_name} - ${s.troupe_name || '散客'}`}
                  >
                    {s.costume_name}
                  </div>
                ))}
                {daySchedules.length > 3 && (
                  <div style={{ fontSize: '11px', color: '#8c8c8c', textAlign: 'center' }}>
                    +{daySchedules.length - 3} 更多
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">租赁排期</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-default'}`}
            onClick={() => { setViewMode('list'); loadSchedules(); }}
          >
            列表视图
          </button>
          <button 
            className={`btn ${viewMode === 'calendar' ? 'btn-primary' : 'btn-default'}`}
            onClick={() => { setViewMode('calendar'); loadCalendarSchedules(); }}
          >
            日历视图
          </button>
          <button className="btn btn-primary" onClick={handleAdd}>
            + 新增排期
          </button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="card">
          <div className="search-bar">
            <div className="form-item">
              <select
                className="form-input"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="">全部状态</option>
                <option value="reserved">已预约</option>
                <option value="confirmed">已确认</option>
                <option value="outbound">已出库</option>
                <option value="returned">已归还</option>
                <option value="cancelled">已取消</option>
              </select>
            </div>
            <div className="form-item">
              <select
                className="form-input"
                value={troupeFilter}
                onChange={e => setTroupeFilter(e.target.value)}
              >
                <option value="">全部剧团</option>
                {troupes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
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
            <button className="btn btn-primary" onClick={handleSearch}>搜索</button>
          </div>

          {loading ? (
            <div>加载中...</div>
          ) : schedules.length === 0 ? (
            <div className="empty">暂无排期数据</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>排期号</th>
                  <th>剧团/客户</th>
                  <th>服装名称</th>
                  <th>数量</th>
                  <th>起租日期</th>
                  <th>归还日期</th>
                  <th>天数</th>
                  <th>费用</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map(s => (
                  <tr key={s.id}>
                    <td>{s.schedule_no}</td>
                    <td>{s.troupe_name || '散客'}</td>
                    <td>{s.costume_name}</td>
                    <td>{s.quantity}</td>
                    <td>{dayjs(s.start_date).format('YYYY-MM-DD')}</td>
                    <td>{dayjs(s.end_date).format('YYYY-MM-DD')}</td>
                    <td>{s.rental_days}天</td>
                    <td>¥{s.total_amount}</td>
                    <td>{getStatusTag(s.status)}</td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-default btn-sm" onClick={() => handleView(s)}>详情</button>
                        {s.status === 'reserved' && (
                          <>
                            <button className="btn btn-default btn-sm" onClick={() => handleEdit(s)}>编辑</button>
                            <button className="btn btn-success btn-sm" onClick={() => handleConfirm(s)}>确认</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleCancel(s)}>取消</button>
                          </>
                        )}
                        {s.status === 'confirmed' && (
                          <button className="btn btn-danger btn-sm" onClick={() => handleCancel(s)}>取消</button>
                        )}
                        {s.status === 'reserved' && (
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s)}>删除</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        renderCalendar()
      )}

      <Modal
        title={editingItem ? '编辑排期' : '新增排期'}
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
            <label className="form-label">剧团/客户</label>
            <select
              className="form-input"
              value={formData.troupe_id}
              onChange={e => handleTroupeChange(e.target.value)}
            >
              <option value="">散客</option>
              {troupes.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="form-item">
            <label className="form-label">服装 *</label>
            <select
              className="form-input"
              value={formData.costume_id}
              onChange={e => handleCostumeChange(e.target.value)}
            >
              <option value="">请选择服装</option>
              {costumes.map(c => (
                <option key={c.id} value={c.id}>{c.name} - ¥{c.daily_rate}/天</option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-item">
            <label className="form-label">数量 *</label>
            <input
              type="number"
              className="form-input"
              value={formData.quantity}
              onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
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
        <div className="form-row">
          <div className="form-item">
            <label className="form-label">起租日期 *</label>
            <input
              type="date"
              className="form-input"
              value={formData.start_date}
              onChange={e => handleDateChange('start_date', e.target.value)}
            />
          </div>
          <div className="form-item">
            <label className="form-label">归还日期 *</label>
            <input
              type="date"
              className="form-input"
              value={formData.end_date}
              onChange={e => handleDateChange('end_date', e.target.value)}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-item">
            <label className="form-label">租赁天数</label>
            <input
              type="number"
              className="form-input"
              value={formData.rental_days}
              readOnly
              style={{ background: '#f5f5f5' }}
            />
          </div>
          <div className="form-item">
            <label className="form-label">预计费用</label>
            <input
              type="text"
              className="form-input"
              value={`¥${(formData.daily_rate * formData.rental_days * formData.quantity).toFixed(2)}`}
              readOnly
              style={{ background: '#f5f5f5', color: '#ff4d4f', fontWeight: '600' }}
            />
          </div>
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
          <label className="form-label">破损押金 (元)</label>
          <input
            type="number"
            className="form-input"
            value={formData.damage_deposit}
            onChange={e => setFormData({ ...formData, damage_deposit: parseFloat(e.target.value) || 0 })}
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

      <Modal
        title="排期详情"
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
              <span className="detail-label">排期号：</span>
              <span className="detail-value">{detailItem.schedule_no}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">剧团/客户：</span>
              <span className="detail-value">{detailItem.troupe_name || '散客'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">服装：</span>
              <span className="detail-value">{detailItem.costume_name}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">数量：</span>
              <span className="detail-value">{detailItem.quantity} 件</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">租赁时间：</span>
              <span className="detail-value">
                {dayjs(detailItem.start_date).format('YYYY-MM-DD')} 至 {dayjs(detailItem.end_date).format('YYYY-MM-DD')}
                （共 {detailItem.rental_days} 天）
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">日租金：</span>
              <span className="detail-value">¥{detailItem.daily_rate}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">总费用：</span>
              <span className="detail-value" style={{ color: '#ff4d4f', fontWeight: '600' }}>¥{detailItem.total_amount}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">破损押金：</span>
              <span className="detail-value">¥{detailItem.damage_deposit}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">状态：</span>
              <span className="detail-value">{getStatusTag(detailItem.status)}</span>
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
              <span className="detail-label">备注：</span>
              <span className="detail-value">{detailItem.remark || '-'}</span>
            </div>

            {detailItem.batch_id && (
              <>
                <div className="divider"></div>
                <h4 style={{ marginBottom: '12px' }}>出库信息</h4>
                <div className="detail-row">
                  <span className="detail-label">批次号：</span>
                  <span className="detail-value">{detailItem.batch_no}</span>
                </div>
              </>
            )}

            {detailItem.outbound_records?.length > 0 && (
              <>
                <div className="divider"></div>
                <h4 style={{ marginBottom: '12px' }}>出库记录</h4>
                <table className="table">
                  <thead>
                    <tr>
                      <th>出库单号</th>
                      <th>数量</th>
                      <th>出库时间</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailItem.outbound_records.map(r => (
                      <tr key={r.id}>
                        <td>{r.outbound_no}</td>
                        <td>{r.total_quantity}</td>
                        <td>{r.outbound_date}</td>
                        <td><span className="tag tag-orange">已出库</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {detailItem.return_records?.length > 0 && (
              <>
                <div className="divider"></div>
                <h4 style={{ marginBottom: '12px' }}>归还记录</h4>
                <table className="table">
                  <thead>
                    <tr>
                      <th>归还单号</th>
                      <th>数量</th>
                      <th>归还时间</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailItem.return_records.map(r => (
                      <tr key={r.id}>
                        <td>{r.return_no}</td>
                        <td>{r.total_quantity}</td>
                        <td>{r.return_date}</td>
                        <td><span className="tag tag-green">已归还</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}

export default Schedules;
