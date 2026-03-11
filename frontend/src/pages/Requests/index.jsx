import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Modal, Form, Input, Select, Tag, Space, message,
  InputNumber, Typography, Drawer, Descriptions, Divider, Tooltip
} from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import api from '../../api'
import { useAuth } from '../../context/AuthContext'

const { Title, Text } = Typography
const { TextArea } = Input
const { Option } = Select

const STATUS_LABELS = {
  draft: 'Черновик',
  pending_assignment: 'Ожидает назначения',
  assigned: 'Назначена',
  clarification_requested: 'Запрошено уточнение',
  clarification_provided: 'Уточнение предоставлено',
  in_progress: 'В работе',
  completed: 'Завершена',
  cancelled: 'Отменена'
}

const STATUS_COLORS = {
  draft: 'default',
  pending_assignment: 'orange',
  assigned: 'blue',
  clarification_requested: 'red',
  clarification_provided: 'cyan',
  in_progress: 'processing',
  completed: 'green',
  cancelled: 'default'
}

export default function RequestsPage() {
  const { user } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [filters, setFilters] = useState({ status: '', search: '' })
  const [createModal, setCreateModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [assignModal, setAssignModal] = useState(false)
  const [clarifyModal, setClarifyModal] = useState(false)
  const [provideClarifyModal, setProvideClarifyModal] = useState(false)
  const [detailDrawer, setDetailDrawer] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [hrManagers, setHrManagers] = useState([])
  const [templates, setTemplates] = useState([])
  const [classifiers, setClassifiers] = useState([])
  const [form] = Form.useForm()
  const [assignForm] = Form.useForm()
  const [clarifyForm] = Form.useForm()
  const [provideClarifyForm] = Form.useForm()

  const fetchData = useCallback(async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const params = { page, limit: pageSize }
      if (filters.status) params.status = filters.status
      if (filters.search) params.search = filters.search
      const res = await api.get('/requests', { params })
      setData(res.data.data || [])
      setPagination(prev => ({ ...prev, current: page, pageSize, total: res.data.pagination?.total || 0 }))
    } catch (err) {
      message.error('Ошибка загрузки заявок')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (user?.role === 'hr_director' || user?.role === 'functional_manager') {
      api.get('/users?role=hr_manager').then(res => setHrManagers(res.data.data || [])).catch(() => {})
    }
    api.get('/templates').then(res => setTemplates(res.data.data || [])).catch(() => {})
    api.get('/classifiers').then(res => setClassifiers(res.data.data || [])).catch(() => {})
  }, [user])

  const handleCreate = async (values) => {
    try {
      const payload = {
        ...values,
        requirements_json: values.requirements_json || []
      }
      await api.post('/requests', payload)
      message.success('Заявка создана')
      setCreateModal(false)
      form.resetFields()
      fetchData()
    } catch (err) {
      message.error(err.response?.data?.message || 'Ошибка создания')
    }
  }

  const handleSubmit = async (id) => {
    try {
      await api.post(`/requests/${id}/submit`)
      message.success('Заявка подана')
      fetchData()
    } catch (err) {
      message.error(err.response?.data?.message || 'Ошибка')
    }
  }

  const handleAssign = async (values) => {
    try {
      await api.post(`/requests/${selectedRecord.id}/assign`, values)
      message.success('Менеджер назначен')
      setAssignModal(false)
      assignForm.resetFields()
      fetchData()
    } catch (err) {
      message.error(err.response?.data?.message || 'Ошибка назначения')
    }
  }

  const handleRequestClarify = async (values) => {
    try {
      await api.post(`/requests/${selectedRecord.id}/request-clarification`, values)
      message.success('Уточнение запрошено')
      setClarifyModal(false)
      clarifyForm.resetFields()
      fetchData()
    } catch (err) {
      message.error(err.response?.data?.message || 'Ошибка')
    }
  }

  const handleProvideClarify = async (values) => {
    try {
      await api.post(`/requests/${selectedRecord.id}/provide-clarification`, values)
      message.success('Уточнение предоставлено')
      setProvideClarifyModal(false)
      provideClarifyForm.resetFields()
      fetchData()
    } catch (err) {
      message.error(err.response?.data?.message || 'Ошибка')
    }
  }

  const handleAccept = async (id) => {
    try {
      await api.post(`/requests/${id}/accept`)
      message.success('Заявка принята в работу')
      fetchData()
    } catch (err) {
      message.error(err.response?.data?.message || 'Ошибка')
    }
  }

  const handleCancel = async (id) => {
    Modal.confirm({
      title: 'Отменить заявку?',
      onOk: async () => {
        try {
          await api.post(`/requests/${id}/cancel`)
          message.success('Заявка отменена')
          fetchData()
        } catch (err) {
          message.error(err.response?.data?.message || 'Ошибка')
        }
      }
    })
  }

  const openDetail = async (record) => {
    try {
      const res = await api.get(`/requests/${record.id}`)
      setSelectedRecord(res.data.data)
      setDetailDrawer(true)
    } catch {}
  }

  const handleTemplateChange = (templateId) => {
    const template = templates.find(t => t.id === templateId)
    if (template) {
      try {
        const reqs = JSON.parse(template.requirements_json || '[]')
        form.setFieldsValue({ requirements_json: reqs })
      } catch {}
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: 'Название',
      dataIndex: 'title',
      render: (text, record) => (
        <a onClick={() => openDetail(record)}>{text}</a>
      )
    },
    { title: 'Отдел', dataIndex: 'department', width: 130 },
    {
      title: 'Зарплата',
      width: 160,
      render: (_, r) => r.salary_from || r.salary_to
        ? `${r.salary_from ? r.salary_from.toLocaleString() : '?'} — ${r.salary_to ? r.salary_to.toLocaleString() : '?'} ₽`
        : '—'
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      width: 170,
      render: s => <Tag color={STATUS_COLORS[s]}>{STATUS_LABELS[s]}</Tag>
    },
    {
      title: 'Менеджер',
      dataIndex: 'manager_name',
      width: 160,
      render: v => v || '—'
    },
    {
      title: 'Создана',
      dataIndex: 'created_at',
      width: 110,
      render: v => dayjs(v).format('DD.MM.YYYY')
    },
    {
      title: 'Действия',
      width: 220,
      render: (_, record) => (
        <Space size={4} wrap>
          {user?.role === 'functional_manager' && record.status === 'draft' && (
            <Button size="small" type="primary" onClick={() => handleSubmit(record.id)}>Подать</Button>
          )}
          {user?.role === 'functional_manager' && record.status === 'clarification_requested' && (
            <Button size="small" type="default" onClick={() => { setSelectedRecord(record); setProvideClarifyModal(true) }}>
              Уточнить
            </Button>
          )}
          {user?.role === 'hr_director' && ['pending_assignment', 'assigned'].includes(record.status) && (
            <Button size="small" onClick={() => { setSelectedRecord(record); setAssignModal(true) }}>
              Назначить
            </Button>
          )}
          {user?.role === 'hr_manager' && ['assigned', 'clarification_provided'].includes(record.status) && (
            <Button size="small" type="primary" onClick={() => handleAccept(record.id)}>В работу</Button>
          )}
          {user?.role === 'hr_manager' && ['assigned', 'in_progress'].includes(record.status) && (
            <Button size="small" onClick={() => { setSelectedRecord(record); setClarifyModal(true) }}>
              Уточнение
            </Button>
          )}
          {(user?.role === 'hr_director' || (user?.role === 'functional_manager' && record.created_by === user.id)) &&
            record.status !== 'cancelled' && (
              <Button size="small" danger onClick={() => handleCancel(record.id)}>Отменить</Button>
            )}
        </Space>
      )
    }
  ]

  const requirementOptions = classifiers.map(c => ({ label: c.name, value: c.name }))

  return (
    <div>
      <div className="page-header">
        <Title level={3} style={{ margin: 0 }}>
          {user?.role === 'functional_manager' ? 'Мои заявки' : 'Заявки на вакансии'}
        </Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>Обновить</Button>
          {user?.role === 'functional_manager' && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>
              Создать заявку
            </Button>
          )}
        </Space>
      </div>

      <div className="filter-row">
        <Select
          allowClear
          placeholder="Фильтр по статусу"
          style={{ width: 200 }}
          value={filters.status || undefined}
          onChange={v => setFilters(prev => ({ ...prev, status: v || '' }))}
        >
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <Option key={k} value={k}>{v}</Option>
          ))}
        </Select>
        <Input.Search
          placeholder="Поиск по названию"
          style={{ width: 240 }}
          value={filters.search}
          onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
          onSearch={() => fetchData()}
          allowClear
        />
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: (total) => `Всего: ${total}`,
          onChange: (page, pageSize) => fetchData(page, pageSize)
        }}
        size="small"
        style={{ background: '#fff', borderRadius: 8 }}
      />

      {/* Create Modal */}
      <Modal
        title="Создать заявку на вакансию"
        open={createModal}
        onCancel={() => { setCreateModal(false); form.resetFields() }}
        onOk={() => form.submit()}
        width={640}
        okText="Создать"
        cancelText="Отмена"
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="template_id" label="Шаблон (необязательно)">
            <Select placeholder="Выбрать шаблон" allowClear onChange={handleTemplateChange}>
              {templates.map(t => <Option key={t.id} value={t.id}>{t.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="title" label="Название должности" rules={[{ required: true }]}>
            <Input placeholder="Например: Senior Frontend Developer" />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <TextArea rows={3} placeholder="Описание вакансии..." />
          </Form.Item>
          <Form.Item name="department" label="Отдел">
            <Input placeholder="Разработка, Аналитика..." />
          </Form.Item>
          <Space style={{ width: '100%' }}>
            <Form.Item name="salary_from" label="Зарплата от (₽)">
              <InputNumber style={{ width: 180 }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} min={0} />
            </Form.Item>
            <Form.Item name="salary_to" label="Зарплата до (₽)">
              <InputNumber style={{ width: 180 }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} min={0} />
            </Form.Item>
          </Space>
          <Form.Item name="requirements_json" label="Требования">
            <Select mode="tags" placeholder="Добавьте требования из списка или введите свои" options={requirementOptions} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Assign Manager Modal */}
      <Modal
        title="Назначить HR менеджера"
        open={assignModal}
        onCancel={() => { setAssignModal(false); assignForm.resetFields() }}
        onOk={() => assignForm.submit()}
        okText="Назначить"
        cancelText="Отмена"
      >
        <Form form={assignForm} layout="vertical" onFinish={handleAssign}>
          <Form.Item name="manager_id" label="HR Менеджер" rules={[{ required: true }]}>
            <Select placeholder="Выберите менеджера">
              {hrManagers.map(m => <Option key={m.id} value={m.id}>{m.name}</Option>)}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Request Clarification Modal */}
      <Modal
        title="Запросить уточнение"
        open={clarifyModal}
        onCancel={() => { setClarifyModal(false); clarifyForm.resetFields() }}
        onOk={() => clarifyForm.submit()}
        okText="Запросить"
        cancelText="Отмена"
      >
        <Form form={clarifyForm} layout="vertical" onFinish={handleRequestClarify}>
          <Form.Item name="clarification_notes" label="Вопросы и уточнения" rules={[{ required: true }]}>
            <TextArea rows={4} placeholder="Опишите что именно нужно уточнить..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Provide Clarification Modal */}
      <Modal
        title="Предоставить уточнение"
        open={provideClarifyModal}
        onCancel={() => { setProvideClarifyModal(false); provideClarifyForm.resetFields() }}
        onOk={() => provideClarifyForm.submit()}
        okText="Отправить"
        cancelText="Отмена"
      >
        {selectedRecord?.clarification_notes && (
          <div style={{ marginBottom: 16, padding: 12, background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 6 }}>
            <Text strong>Вопрос от HR менеджера:</Text>
            <p style={{ margin: '4px 0 0' }}>{selectedRecord.clarification_notes}</p>
          </div>
        )}
        <Form form={provideClarifyForm} layout="vertical" onFinish={handleProvideClarify}>
          <Form.Item name="clarification_response" label="Ваш ответ" rules={[{ required: true }]}>
            <TextArea rows={4} placeholder="Предоставьте уточнение..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={selectedRecord?.title}
        open={detailDrawer}
        onClose={() => setDetailDrawer(false)}
        width={520}
      >
        {selectedRecord && (
          <div>
            <Tag color={STATUS_COLORS[selectedRecord.status]} style={{ marginBottom: 16 }}>
              {STATUS_LABELS[selectedRecord.status]}
            </Tag>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Отдел">{selectedRecord.department || '—'}</Descriptions.Item>
              <Descriptions.Item label="Зарплата">
                {selectedRecord.salary_from || selectedRecord.salary_to
                  ? `${selectedRecord.salary_from?.toLocaleString() || '?'} — ${selectedRecord.salary_to?.toLocaleString() || '?'} ₽`
                  : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Создал">{selectedRecord.creator_name}</Descriptions.Item>
              <Descriptions.Item label="HR Менеджер">{selectedRecord.manager_name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Создана">{dayjs(selectedRecord.created_at).format('DD.MM.YYYY HH:mm')}</Descriptions.Item>
            </Descriptions>
            {selectedRecord.description && (
              <>
                <Divider />
                <Text strong>Описание:</Text>
                <p>{selectedRecord.description}</p>
              </>
            )}
            {selectedRecord.requirements_json && (() => {
              try {
                const reqs = JSON.parse(selectedRecord.requirements_json)
                if (reqs.length > 0) return (
                  <>
                    <Divider />
                    <Text strong>Требования:</Text>
                    <div style={{ marginTop: 8 }}>
                      {reqs.map(r => <Tag key={r} style={{ marginBottom: 4 }}>{r}</Tag>)}
                    </div>
                  </>
                )
              } catch {}
              return null
            })()}
            {selectedRecord.clarification_notes && (
              <>
                <Divider />
                <Text strong>Запрос уточнения:</Text>
                <p>{selectedRecord.clarification_notes}</p>
              </>
            )}
            {selectedRecord.clarification_response && (
              <>
                <Text strong>Ответ на уточнение:</Text>
                <p>{selectedRecord.clarification_response}</p>
              </>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
