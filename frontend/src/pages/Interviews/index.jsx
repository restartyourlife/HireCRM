import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Modal, Form, Input, Select, Tag, Space, message,
  InputNumber, DatePicker, Typography, Popconfirm
} from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import api from '../../api'
import { useAuth } from '../../context/AuthContext'

const { Title } = Typography
const { TextArea } = Input
const { Option } = Select

const STATUS_COLORS = {
  scheduled: 'blue',
  conducted: 'green',
  cancelled: 'red'
}

const STATUS_LABELS = {
  scheduled: 'Запланировано',
  conducted: 'Проведено',
  cancelled: 'Отменено'
}

export default function InterviewsPage() {
  const { user } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [filters, setFilters] = useState({ status: '' })
  const [modalOpen, setModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState(null)
  const [applications, setApplications] = useState([])
  const [form] = Form.useForm()

  const fetchData = useCallback(async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const params = { page, limit: pageSize }
      if (filters.status) params.status = filters.status
      const res = await api.get('/interviews', { params })
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

  const openCreate = () => {
    setEditRecord(null)
    form.resetFields()
    setModalOpen(true)
  }

  const handleSubmit = async (values) => {
    try {
      const payload = {
        ...values,
        scheduled_at: values.scheduled_at?.toISOString()
      }
      if (editRecord) {
        await api.put(`/interviews/${editRecord.id}`, payload)
        message.success('Обновлено')
      } else {
        await api.post('/interviews', payload)
        message.success('Собеседование запланировано')
      }
      setModalOpen(false)
      form.resetFields()
      fetchData()
    } catch (err) {
      message.error(err.response?.data?.message || 'Ошибка')
    }
  }

  const handleConduct = async (id) => {
    try {
      await api.put(`/interviews/${id}`, { status: 'conducted' })
      message.success('Отмечено как проведённое')
      fetchData()
    } catch (err) {
      message.error(err.response?.data?.message || 'Ошибка')
    }
  }

  const handleCancel = async (id) => {
    try {
      await api.post(`/interviews/${id}/cancel`)
      message.success('Отменено')
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
      title: 'Дата/Время',
      dataIndex: 'scheduled_at',
      width: 150,
      render: v => dayjs(v).format('DD.MM.YYYY HH:mm')
    },
    { title: 'Длительность', dataIndex: 'duration_minutes', width: 120, render: v => `${v} мин` },
    { title: 'Место', dataIndex: 'location', render: v => v || '—' },
    {
      title: 'Ссылка',
      dataIndex: 'calendar_link',
      render: v => v ? <a href={v} target="_blank" rel="noreferrer">Открыть</a> : '—'
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      width: 130,
      render: s => <Tag color={STATUS_COLORS[s]}>{STATUS_LABELS[s]}</Tag>
    },
    {
      title: 'Действия',
      width: 160,
      render: (_, r) => (
        <Space>
          {r.status === 'scheduled' && (
            <>
              <Button size="small" type="primary" onClick={() => handleConduct(r.id)}>Провести</Button>
              <Popconfirm title="Отменить?" onConfirm={() => handleCancel(r.id)} okText="Да" cancelText="Нет">
                <Button size="small" danger>Отменить</Button>
              </Popconfirm>
            </>
          )}
        </Space>
      )
    }
  ]

  if (user?.role !== 'hr_manager') {
    return (
      <div>
        <Title level={3}>Собеседования</Title>
        <p>Эта страница доступна только HR менеджерам.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <Title level={3} style={{ margin: 0 }}>Собеседования</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>Обновить</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Запланировать</Button>
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
          <Option value="scheduled">Запланировано</Option>
          <Option value="conducted">Проведено</Option>
          <Option value="cancelled">Отменено</Option>
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
        title="Запланировать собеседование"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        onOk={() => form.submit()}
        width={560}
        okText="Сохранить"
        cancelText="Отмена"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="application_id" label="Заявка на работу" rules={[{ required: true }]}>
            <Select placeholder="Выберите заявку" showSearch optionFilterProp="children">
              {applications.map(a => (
                <Option key={a.id} value={a.id}>#{a.id} {a.candidate_name} — {a.vacancy_title}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="scheduled_at" label="Дата и время" rules={[{ required: true }]}>
            <DatePicker showTime format="DD.MM.YYYY HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="duration_minutes" label="Длительность (мин)" initialValue={60}>
            <InputNumber min={15} max={480} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="location" label="Место проведения">
            <Input placeholder="Конференц-зал А, Zoom..." />
          </Form.Item>
          <Form.Item name="calendar_link" label="Ссылка Яндекс.Календарь">
            <Input placeholder="https://calendar.yandex.ru/..." />
          </Form.Item>
          <Form.Item name="notes" label="Заметки">
            <TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
