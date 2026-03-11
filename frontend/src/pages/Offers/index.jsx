import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Modal, Form, Input, Select, Tag, Space, message,
  Typography, InputNumber
} from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import api from '../../api'
import { useAuth } from '../../context/AuthContext'

const { Title } = Typography
const { TextArea } = Input
const { Option } = Select

const STATUS_LABELS = {
  prepared: 'Подготовлен',
  sent: 'Отправлен',
  accepted: 'Принят',
  declined: 'Отклонён'
}

const STATUS_COLORS = {
  prepared: 'blue',
  sent: 'processing',
  accepted: 'green',
  declined: 'red'
}

export default function OffersPage() {
  const { user } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [filters, setFilters] = useState({ status: '' })
  const [createModal, setCreateModal] = useState(false)
  const [actionModal, setActionModal] = useState({ open: false, type: '', title: '', record: null })
  const [applications, setApplications] = useState([])
  const [form] = Form.useForm()
  const [actionForm] = Form.useForm()

  const fetchData = useCallback(async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const params = { page, limit: pageSize }
      if (filters.status) params.status = filters.status
      const res = await api.get('/offers', { params })
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
    api.get('/applications?limit=100').then(res => setApplications(res.data.data || [])).catch(() => {})
  }, [])

  const handleCreate = async (values) => {
    try {
      await api.post('/offers', values)
      message.success('Оффер создан')
      setCreateModal(false)
      form.resetFields()
      fetchData()
    } catch (err) {
      message.error(err.response?.data?.message || 'Ошибка')
    }
  }

  const doAction = async (type, values = {}) => {
    const id = actionModal.record?.id
    try {
      if (type === 'send') await api.post(`/offers/${id}/send`)
      else if (type === 'accept') await api.post(`/offers/${id}/accept`, values)
      else if (type === 'decline') await api.post(`/offers/${id}/decline`, values)
      message.success('Действие выполнено')
      setActionModal({ open: false, type: '', title: '', record: null })
      actionForm.resetFields()
      fetchData()
    } catch (err) {
      message.error(err.response?.data?.message || 'Ошибка')
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: 'Кандидат', dataIndex: 'candidate_name', render: v => v || '—' },
    { title: 'Вакансия', dataIndex: 'vacancy_title', render: v => v || '—' },
    {
      title: 'Зарплата',
      dataIndex: 'salary',
      width: 140,
      render: v => v ? `${v.toLocaleString()} ₽` : '—'
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      width: 130,
      render: s => <Tag color={STATUS_COLORS[s]}>{STATUS_LABELS[s]}</Tag>
    },
    {
      title: 'Отправлен',
      dataIndex: 'sent_at',
      width: 120,
      render: v => v ? dayjs(v).format('DD.MM.YYYY') : '—'
    },
    {
      title: 'Ответ',
      dataIndex: 'response_at',
      width: 120,
      render: v => v ? dayjs(v).format('DD.MM.YYYY') : '—'
    },
    {
      title: 'Действия',
      width: 200,
      render: (_, r) => (
        <Space>
          {r.status === 'prepared' && (
            <Button size="small" type="primary" onClick={() => setActionModal({ open: true, type: 'send', title: 'Отправить оффер', record: r })}>
              Отправить
            </Button>
          )}
          {r.status === 'sent' && (
            <>
              <Button size="small" type="primary" onClick={() => setActionModal({ open: true, type: 'accept', title: 'Оффер принят', record: r })}>
                Принят
              </Button>
              <Button size="small" danger onClick={() => setActionModal({ open: true, type: 'decline', title: 'Оффер отклонён', record: r })}>
                Отклонён
              </Button>
            </>
          )}
        </Space>
      )
    }
  ]

  if (user?.role !== 'hr_manager') {
    return (
      <div>
        <Title level={3}>Офферы</Title>
        <p>Эта страница доступна только HR менеджерам.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <Title level={3} style={{ margin: 0 }}>Офферы</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>Обновить</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>
            Создать оффер
          </Button>
        </Space>
      </div>

      <div className="filter-row">
        <Select
          allowClear
          placeholder="Статус"
          style={{ width: 160 }}
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

      <Modal
        title="Создать оффер"
        open={createModal}
        onCancel={() => { setCreateModal(false); form.resetFields() }}
        onOk={() => form.submit()}
        okText="Создать"
        cancelText="Отмена"
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="application_id" label="Заявка на работу" rules={[{ required: true }]}>
            <Select placeholder="Выберите заявку" showSearch>
              {applications.map(a => (
                <Option key={a.id} value={a.id}>#{a.id} {a.candidate_name} — {a.vacancy_title}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="salary" label="Зарплата (₽)" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} />
          </Form.Item>
          <Form.Item name="additional_conditions" label="Дополнительные условия">
            <TextArea rows={3} placeholder="ДМС, компенсация питания, удалённая работа..." />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={actionModal.title}
        open={actionModal.open}
        onCancel={() => { setActionModal({ open: false, type: '', title: '', record: null }); actionForm.resetFields() }}
        onOk={() => {
          if (actionModal.type === 'send') doAction('send')
          else actionForm.submit()
        }}
        okText="Подтвердить"
        cancelText="Отмена"
      >
        {actionModal.type !== 'send' && (
          <Form form={actionForm} layout="vertical" onFinish={(v) => doAction(actionModal.type, v)}>
            <Form.Item name="response_notes" label="Примечания">
              <TextArea rows={3} />
            </Form.Item>
          </Form>
        )}
        {actionModal.type === 'send' && <p>Подтвердить отправку оффера кандидату?</p>}
      </Modal>
    </div>
  )
}
