import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Modal, Form, Input, Select, Tag, Space, message,
  Typography, DatePicker
} from 'antd'
import { PlusOutlined, ReloadOutlined, CheckOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import api from '../../api'
import { useAuth } from '../../context/AuthContext'

const { Title } = Typography
const { TextArea } = Input
const { Option } = Select

const STATUS_LABELS = {
  pending: 'Ожидает',
  in_progress: 'В работе',
  completed: 'Выполнено'
}

const STATUS_COLORS = {
  pending: 'orange',
  in_progress: 'processing',
  completed: 'green'
}

export default function WorkplaceTasksPage() {
  const { user } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [filters, setFilters] = useState({ status: '' })
  const [createModal, setCreateModal] = useState(false)
  const [users, setUsers] = useState([])
  const [form] = Form.useForm()

  const fetchData = useCallback(async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const params = { page, limit: pageSize }
      if (filters.status) params.status = filters.status
      const res = await api.get('/workplace-tasks', { params })
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
    api.get('/users').then(res => setUsers(res.data.data || [])).catch(() => {})
  }, [])

  const handleCreate = async (values) => {
    try {
      const payload = {
        ...values,
        due_date: values.due_date?.format('YYYY-MM-DD')
      }
      await api.post('/workplace-tasks', payload)
      message.success('Задача создана')
      setCreateModal(false)
      form.resetFields()
      fetchData()
    } catch (err) {
      message.error(err.response?.data?.message || 'Ошибка')
    }
  }

  const handleComplete = async (id) => {
    try {
      await api.post(`/workplace-tasks/${id}/complete`)
      message.success('Задача выполнена')
      fetchData()
    } catch (err) {
      message.error(err.response?.data?.message || 'Ошибка')
    }
  }

  const handleStatusChange = async (id, status) => {
    try {
      await api.put(`/workplace-tasks/${id}`, { status })
      message.success('Статус обновлён')
      fetchData()
    } catch (err) {
      message.error(err.response?.data?.message || 'Ошибка')
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: 'Задача', dataIndex: 'title' },
    { title: 'Кандидат', dataIndex: 'candidate_name', render: v => v || '—' },
    { title: 'Вакансия', dataIndex: 'vacancy_title', render: v => v || '—' },
    {
      title: 'Ответственный',
      dataIndex: 'assigned_to_name',
      render: v => v || '—'
    },
    {
      title: 'Срок',
      dataIndex: 'due_date',
      width: 110,
      render: v => v ? dayjs(v).format('DD.MM.YYYY') : '—'
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      width: 120,
      render: s => <Tag color={STATUS_COLORS[s]}>{STATUS_LABELS[s]}</Tag>
    },
    {
      title: 'Действия',
      width: 200,
      render: (_, r) => (
        <Space>
          {r.status === 'pending' && (
            <Button size="small" onClick={() => handleStatusChange(r.id, 'in_progress')}>Начать</Button>
          )}
          {r.status !== 'completed' && (
            <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleComplete(r.id)}>
              Завершить
            </Button>
          )}
        </Space>
      )
    }
  ]

  if (user?.role !== 'hr_manager' && user?.role !== 'hr_director') {
    return (
      <div>
        <Title level={3}>Задачи по рабочим местам</Title>
        <p>Эта страница доступна HR менеджерам и директору.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <Title level={3} style={{ margin: 0 }}>Задачи по рабочим местам</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>Обновить</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>
            Создать задачу
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
        title="Создать задачу"
        open={createModal}
        onCancel={() => { setCreateModal(false); form.resetFields() }}
        onOk={() => form.submit()}
        width={560}
        okText="Создать"
        cancelText="Отмена"
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="title" label="Название задачи" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="assigned_to" label="Ответственный">
            <Select placeholder="Выберите ответственного" allowClear>
              {users.map(u => <Option key={u.id} value={u.id}>{u.name} ({u.role})</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="due_date" label="Срок исполнения">
            <DatePicker format="DD.MM.YYYY" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
