import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Modal, Form, Input, Select, Tag, Space, message,
  Drawer, Descriptions, Divider, Typography, Steps, List, InputNumber,
  DatePicker, Card
} from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import api from '../../api'
import { useAuth } from '../../context/AuthContext'

const { Title, Text } = Typography
const { TextArea } = Input
const { Option } = Select

const STATUS_LABELS = {
  search: 'Поиск',
  interview_scheduled: 'Собеседование запланировано',
  interview_conducted: 'Собеседование проведено',
  test_assigned: 'ТЗ выдано',
  test_submitted: 'ТЗ сдано',
  test_evaluated: 'ТЗ оценено',
  pending_candidate_approval: 'Ожидает согласования',
  candidate_approved: 'Кандидат согласован',
  offer_prepared: 'Оффер подготовлен',
  offer_accepted: 'Оффер принят',
  offer_declined: 'Оффер отклонён',
  hired: 'Принят',
  rejected: 'Отклонён'
}

const STATUS_COLORS = {
  search: 'blue',
  interview_scheduled: 'cyan',
  interview_conducted: 'geekblue',
  test_assigned: 'purple',
  test_submitted: 'orange',
  test_evaluated: 'lime',
  pending_candidate_approval: 'orange',
  candidate_approved: 'green',
  offer_prepared: 'blue',
  offer_accepted: 'green',
  offer_declined: 'red',
  hired: 'green',
  rejected: 'red'
}

const PROCESS_STEPS = [
  { key: 'search', title: 'Поиск' },
  { key: 'interview_scheduled', title: 'Собеседование' },
  { key: 'interview_conducted', title: 'Проведено' },
  { key: 'test_assigned', title: 'ТЗ выдано' },
  { key: 'test_submitted', title: 'ТЗ сдано' },
  { key: 'test_evaluated', title: 'ТЗ оценено' },
  { key: 'pending_candidate_approval', title: 'Согласование' },
  { key: 'candidate_approved', title: 'Согласован' },
  { key: 'offer_prepared', title: 'Оффер' },
  { key: 'offer_accepted', title: 'Принят' }
]

export default function ApplicationsPage() {
  const { user } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [filters, setFilters] = useState({ status: '' })
  const [detailDrawer, setDetailDrawer] = useState(false)
  const [selectedApp, setSelectedApp] = useState(null)
  const [createModal, setCreateModal] = useState(false)
  const [actionModal, setActionModal] = useState({ open: false, type: '', title: '' })
  const [requests, setRequests] = useState([])
  const [candidates, setCandidates] = useState([])
  const [form] = Form.useForm()
  const [actionForm] = Form.useForm()

  const fetchData = useCallback(async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const params = { page, limit: pageSize }
      if (filters.status) params.status = filters.status
      const res = await api.get('/applications', { params })
      setData(res.data.data || [])
      setPagination(prev => ({ ...prev, current: page, pageSize, total: res.data.pagination?.total || 0 }))
    } catch {
      message.error('Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (user?.role === 'hr_manager') {
      api.get('/requests?limit=100').then(res => setRequests(res.data.data || [])).catch(() => {})
      api.get('/candidates?limit=100').then(res => setCandidates(res.data.data || [])).catch(() => {})
    }
  }, [user])

  const openDetail = async (id) => {
    try {
      const res = await api.get(`/applications/${id}`)
      setSelectedApp(res.data.data)
      setDetailDrawer(true)
    } catch {
      message.error('Ошибка загрузки')
    }
  }

  const refreshDetail = async () => {
    if (selectedApp) {
      try {
        const res = await api.get(`/applications/${selectedApp.id}`)
        setSelectedApp(res.data.data)
        fetchData()
      } catch {}
    }
  }

  const handleCreate = async (values) => {
    try {
      await api.post('/applications', values)
      message.success('Заявка создана')
      setCreateModal(false)
      form.resetFields()
      fetchData()
    } catch (err) {
      message.error(err.response?.data?.message || 'Ошибка')
    }
  }

  const doAction = async (type, values = {}) => {
    if (!selectedApp) return
    const id = selectedApp.id
    try {
      if (type === 'schedule-interview') {
        const payload = {
          scheduled_at: values.scheduled_at?.toISOString(),
          duration_minutes: values.duration_minutes,
          location: values.location,
          calendar_link: values.calendar_link
        }
        await api.post(`/applications/${id}/schedule-interview`, payload)
      } else if (type === 'mark-interview-conducted') {
        await api.post(`/applications/${id}/mark-interview-conducted`, values)
      } else if (type === 'assign-test') {
        await api.post(`/applications/${id}/assign-test`, {
          ...values,
          deadline: values.deadline?.toISOString()
        })
      } else if (type === 'submit-test') {
        await api.post(`/applications/${id}/submit-test`, values)
      } else if (type === 'evaluate-test') {
        await api.post(`/applications/${id}/evaluate-test`, values)
      } else if (type === 'send-for-approval') {
        await api.post(`/applications/${id}/send-for-approval`)
      } else if (type === 'approve-candidate') {
        await api.post(`/applications/${id}/approve-candidate`, values)
      } else if (type === 'reject') {
        await api.post(`/applications/${id}/reject`, values)
      } else if (type === 'prepare-offer') {
        await api.post(`/applications/${id}/prepare-offer`, values)
      } else if (type === 'accept-offer') {
        await api.post(`/applications/${id}/accept-offer`, values)
      } else if (type === 'decline-offer') {
        await api.post(`/applications/${id}/decline-offer`, values)
      }
      message.success('Действие выполнено')
      setActionModal({ open: false, type: '', title: '' })
      actionForm.resetFields()
      await refreshDetail()
    } catch (err) {
      message.error(err.response?.data?.message || 'Ошибка')
    }
  }

  const openAction = (type, title) => {
    setActionModal({ open: true, type, title })
    actionForm.resetFields()
  }

  const currentStepIndex = selectedApp
    ? PROCESS_STEPS.findIndex(s => s.key === selectedApp.status)
    : 0

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: 'Кандидат',
      dataIndex: 'candidate_name',
      render: (v, r) => <a onClick={() => openDetail(r.id)}>{v}</a>
    },
    { title: 'Вакансия', dataIndex: 'vacancy_title' },
    { title: 'Отдел', dataIndex: 'department', width: 120 },
    {
      title: 'Статус',
      dataIndex: 'status',
      width: 200,
      render: s => <Tag color={STATUS_COLORS[s]}>{STATUS_LABELS[s]}</Tag>
    },
    {
      title: 'Создана',
      dataIndex: 'created_at',
      width: 110,
      render: v => dayjs(v).format('DD.MM.YYYY')
    },
    {
      title: '',
      width: 80,
      render: (_, r) => <Button size="small" onClick={() => openDetail(r.id)}>Открыть</Button>
    }
  ]

  const renderActionForm = () => {
    const t = actionModal.type
    if (t === 'schedule-interview') return (
      <>
        <Form.Item name="scheduled_at" label="Дата и время" rules={[{ required: true }]}>
          <DatePicker showTime format="DD.MM.YYYY HH:mm" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="duration_minutes" label="Длительность (мин)" initialValue={60}>
          <InputNumber min={15} max={480} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="location" label="Место проведения">
          <Input placeholder="Конференц-зал, Zoom..." />
        </Form.Item>
        <Form.Item name="calendar_link" label="Ссылка Яндекс.Календарь">
          <Input placeholder="https://calendar.yandex.ru/..." />
        </Form.Item>
      </>
    )
    if (t === 'mark-interview-conducted') return (
      <Form.Item name="notes" label="Заметки по итогу">
        <TextArea rows={3} />
      </Form.Item>
    )
    if (t === 'assign-test') return (
      <>
        <Form.Item name="description" label="Описание задания" rules={[{ required: true }]}>
          <TextArea rows={4} />
        </Form.Item>
        <Form.Item name="deadline" label="Дедлайн">
          <DatePicker showTime format="DD.MM.YYYY HH:mm" style={{ width: '100%' }} />
        </Form.Item>
      </>
    )
    if (t === 'submit-test') return (
      <Form.Item name="submission_notes" label="Примечания к сдаче">
        <TextArea rows={3} />
      </Form.Item>
    )
    if (t === 'evaluate-test') return (
      <>
        <Form.Item name="evaluation_score" label="Оценка (0-100)">
          <InputNumber min={0} max={100} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="evaluator_comment" label="Комментарий" rules={[{ required: true }]}>
          <TextArea rows={3} />
        </Form.Item>
      </>
    )
    if (t === 'approve-candidate') return (
      <Form.Item name="approval_comment" label="Комментарий">
        <TextArea rows={3} placeholder="Укажите подтверждение ожиданий по зарплате и другие комментарии..." />
      </Form.Item>
    )
    if (t === 'reject') return (
      <Form.Item name="rejection_reason" label="Причина отказа">
        <TextArea rows={3} />
      </Form.Item>
    )
    if (t === 'prepare-offer') return (
      <>
        <Form.Item name="salary" label="Зарплата (₽)" rules={[{ required: true }]}>
          <InputNumber min={0} style={{ width: '100%' }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} />
        </Form.Item>
        <Form.Item name="additional_conditions" label="Дополнительные условия">
          <TextArea rows={3} />
        </Form.Item>
      </>
    )
    if (t === 'accept-offer' || t === 'decline-offer') return (
      <Form.Item name="response_notes" label="Примечания">
        <TextArea rows={3} />
      </Form.Item>
    )
    return null
  }

  return (
    <div>
      <div className="page-header">
        <Title level={3} style={{ margin: 0 }}>Заявки на работу</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>Обновить</Button>
          {user?.role === 'hr_manager' && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>
              Создать
            </Button>
          )}
        </Space>
      </div>

      <div className="filter-row">
        <Select
          allowClear
          placeholder="Фильтр по статусу"
          style={{ width: 240 }}
          value={filters.status || undefined}
          onChange={v => setFilters({ status: v || '' })}
        >
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <Option key={k} value={k}>{v}</Option>
          ))}
        </Select>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: total => `Всего: ${total}`,
          onChange: (page, pageSize) => fetchData(page, pageSize)
        }}
        size="small"
        style={{ background: '#fff', borderRadius: 8 }}
      />

      {/* Create Modal */}
      <Modal
        title="Создать заявку на работу"
        open={createModal}
        onCancel={() => { setCreateModal(false); form.resetFields() }}
        onOk={() => form.submit()}
        okText="Создать"
        cancelText="Отмена"
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="vacancy_request_id" label="Вакансия" rules={[{ required: true }]}>
            <Select placeholder="Выберите вакансию">
              {requests.map(r => <Option key={r.id} value={r.id}>{r.title} ({r.department})</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="candidate_id" label="Кандидат" rules={[{ required: true }]}>
            <Select placeholder="Выберите кандидата" showSearch optionFilterProp="children">
              {candidates.map(c => <Option key={c.id} value={c.id}>{c.name} — {c.current_position || 'нет должности'}</Option>)}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Action Modal */}
      <Modal
        title={actionModal.title}
        open={actionModal.open}
        onCancel={() => { setActionModal({ open: false, type: '', title: '' }); actionForm.resetFields() }}
        onOk={() => {
          if (['send-for-approval'].includes(actionModal.type)) {
            doAction(actionModal.type)
          } else {
            actionForm.submit()
          }
        }}
        okText="Подтвердить"
        cancelText="Отмена"
      >
        <Form form={actionForm} layout="vertical" onFinish={(v) => doAction(actionModal.type, v)}>
          {renderActionForm()}
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={selectedApp ? `Заявка #${selectedApp.id}: ${selectedApp.candidate_name}` : ''}
        open={detailDrawer}
        onClose={() => setDetailDrawer(false)}
        width={640}
        extra={
          <Tag color={STATUS_COLORS[selectedApp?.status]}>{STATUS_LABELS[selectedApp?.status]}</Tag>
        }
      >
        {selectedApp && (
          <div>
            <div className="process-steps">
              <Steps
                current={currentStepIndex >= 0 ? currentStepIndex : 0}
                size="small"
                items={PROCESS_STEPS.slice(0, 8).map(s => ({ title: s.title }))}
              />
            </div>

            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Кандидат" span={2}>{selectedApp.candidate_name}</Descriptions.Item>
              <Descriptions.Item label="Email">{selectedApp.candidate_email || '—'}</Descriptions.Item>
              <Descriptions.Item label="Телефон">{selectedApp.candidate_phone || '—'}</Descriptions.Item>
              <Descriptions.Item label="Вакансия" span={2}>{selectedApp.vacancy_title}</Descriptions.Item>
              <Descriptions.Item label="Отдел">{selectedApp.department || '—'}</Descriptions.Item>
              <Descriptions.Item label="Зарплата">
                {selectedApp.salary_from || selectedApp.salary_to
                  ? `${selectedApp.salary_from?.toLocaleString() || '?'} — ${selectedApp.salary_to?.toLocaleString() || '?'} ₽`
                  : '—'}
              </Descriptions.Item>
            </Descriptions>

            {/* Role-based action buttons */}
            <Card size="small" title="Доступные действия" style={{ marginBottom: 16 }}>
              <div className="action-buttons">
                {user?.role === 'hr_manager' && selectedApp.status === 'search' && (
                  <Button type="primary" size="small" onClick={() => openAction('schedule-interview', 'Запланировать собеседование')}>
                    Запланировать собеседование
                  </Button>
                )}
                {user?.role === 'hr_manager' && selectedApp.status === 'interview_scheduled' && (
                  <Button type="primary" size="small" onClick={() => openAction('mark-interview-conducted', 'Отметить проведённым')}>
                    Собеседование проведено
                  </Button>
                )}
                {user?.role === 'hr_manager' && selectedApp.status === 'interview_conducted' && (
                  <Button type="primary" size="small" onClick={() => openAction('assign-test', 'Назначить тестовое задание')}>
                    Назначить ТЗ
                  </Button>
                )}
                {user?.role === 'hr_manager' && selectedApp.status === 'test_assigned' && (
                  <Button size="small" onClick={() => openAction('submit-test', 'Отметить ТЗ сданным')}>
                    ТЗ сдано
                  </Button>
                )}
                {user?.role === 'functional_manager' && selectedApp.status === 'test_submitted' && (
                  <Button type="primary" size="small" onClick={() => openAction('evaluate-test', 'Оценить тестовое задание')}>
                    Оценить ТЗ
                  </Button>
                )}
                {user?.role === 'hr_manager' && selectedApp.status === 'test_evaluated' && (
                  <Button type="primary" size="small" onClick={() => doAction('send-for-approval')}>
                    На согласование
                  </Button>
                )}
                {user?.role === 'functional_manager' && selectedApp.status === 'pending_candidate_approval' && (
                  <Button type="primary" size="small" onClick={() => openAction('approve-candidate', 'Согласовать кандидата')}>
                    Согласовать
                  </Button>
                )}
                {user?.role === 'hr_manager' && selectedApp.status === 'candidate_approved' && (
                  <Button type="primary" size="small" onClick={() => openAction('prepare-offer', 'Подготовить оффер')}>
                    Подготовить оффер
                  </Button>
                )}
                {user?.role === 'hr_manager' && selectedApp.status === 'offer_prepared' && (
                  <>
                    <Button type="primary" size="small" onClick={() => openAction('accept-offer', 'Оффер принят')}>
                      Оффер принят
                    </Button>
                    <Button danger size="small" onClick={() => openAction('decline-offer', 'Оффер отклонён')}>
                      Оффер отклонён
                    </Button>
                  </>
                )}
                {(user?.role === 'hr_manager' || user?.role === 'functional_manager') &&
                  !['rejected', 'hired', 'offer_accepted', 'offer_declined'].includes(selectedApp.status) && (
                    <Button danger size="small" onClick={() => openAction('reject', 'Отклонить кандидата')}>
                      Отклонить
                    </Button>
                  )}
              </div>
            </Card>

            {/* Interviews */}
            {selectedApp.interviews?.length > 0 && (
              <>
                <Divider orientation="left">Собеседования</Divider>
                <List
                  size="small"
                  dataSource={selectedApp.interviews}
                  renderItem={item => (
                    <List.Item>
                      <Space direction="vertical" size={2} style={{ width: '100%' }}>
                        <Space>
                          <Tag color={item.status === 'conducted' ? 'green' : item.status === 'cancelled' ? 'red' : 'blue'}>
                            {item.status === 'conducted' ? 'Проведено' : item.status === 'cancelled' ? 'Отменено' : 'Запланировано'}
                          </Tag>
                          <Text strong>{dayjs(item.scheduled_at).format('DD.MM.YYYY HH:mm')}</Text>
                          <Text type="secondary">{item.duration_minutes} мин</Text>
                        </Space>
                        {item.location && <Text type="secondary">Место: {item.location}</Text>}
                        {item.calendar_link && <a href={item.calendar_link} target="_blank">Открыть в календаре</a>}
                        {item.notes && <Text type="secondary">Заметки: {item.notes}</Text>}
                      </Space>
                    </List.Item>
                  )}
                />
              </>
            )}

            {/* Test Assignments */}
            {selectedApp.test_assignments?.length > 0 && (
              <>
                <Divider orientation="left">Тестовые задания</Divider>
                <List
                  size="small"
                  dataSource={selectedApp.test_assignments}
                  renderItem={item => (
                    <List.Item>
                      <Space direction="vertical" size={2} style={{ width: '100%' }}>
                        <Space>
                          <Tag color={item.status === 'evaluated' ? 'green' : item.status === 'submitted' ? 'orange' : 'blue'}>
                            {item.status === 'evaluated' ? 'Оценено' : item.status === 'submitted' ? 'Сдано' : 'Выдано'}
                          </Tag>
                          {item.deadline && <Text type="secondary">Дедлайн: {dayjs(item.deadline).format('DD.MM.YYYY')}</Text>}
                        </Space>
                        <Text>{item.description}</Text>
                        {item.evaluation_score !== null && item.evaluation_score !== undefined && (
                          <Text>Оценка: <strong>{item.evaluation_score}/100</strong> — {item.evaluator_comment}</Text>
                        )}
                      </Space>
                    </List.Item>
                  )}
                />
              </>
            )}

            {/* Offers */}
            {selectedApp.offers?.length > 0 && (
              <>
                <Divider orientation="left">Офферы</Divider>
                <List
                  size="small"
                  dataSource={selectedApp.offers}
                  renderItem={item => (
                    <List.Item>
                      <Space direction="vertical" size={2} style={{ width: '100%' }}>
                        <Space>
                          <Tag color={item.status === 'accepted' ? 'green' : item.status === 'declined' ? 'red' : 'blue'}>
                            {item.status === 'accepted' ? 'Принят' : item.status === 'declined' ? 'Отклонён' : item.status === 'sent' ? 'Отправлен' : 'Подготовлен'}
                          </Tag>
                          <Text strong>{item.salary?.toLocaleString()} ₽</Text>
                        </Space>
                        {item.additional_conditions && <Text type="secondary">{item.additional_conditions}</Text>}
                      </Space>
                    </List.Item>
                  )}
                />
              </>
            )}

            {selectedApp.rejection_reason && (
              <>
                <Divider />
                <Text type="danger">Причина отказа: {selectedApp.rejection_reason}</Text>
              </>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
