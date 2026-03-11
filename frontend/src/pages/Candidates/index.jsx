import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Modal, Form, Input, Select, Tag, Space, message,
  InputNumber, Typography, Popconfirm
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import api from '../../api'
import { useAuth } from '../../context/AuthContext'

const { Title } = Typography
const { TextArea } = Input
const { Option } = Select

export default function CandidatesPage() {
  const { user } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [filters, setFilters] = useState({ source: '', search: '' })
  const [modalOpen, setModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState(null)
  const [form] = Form.useForm()

  const fetchData = useCallback(async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const params = { page, limit: pageSize }
      if (filters.source) params.source = filters.source
      if (filters.search) params.search = filters.search
      const res = await api.get('/candidates', { params })
      setData(res.data.data || [])
      setPagination(prev => ({ ...prev, current: page, pageSize, total: res.data.pagination?.total || 0 }))
    } catch {
      message.error('Ошибка загрузки кандидатов')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { fetchData() }, [fetchData])

  const openCreate = () => {
    setEditRecord(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (record) => {
    setEditRecord(record)
    form.setFieldsValue(record)
    setModalOpen(true)
  }

  const handleSubmit = async (values) => {
    try {
      if (editRecord) {
        await api.put(`/candidates/${editRecord.id}`, values)
        message.success('Кандидат обновлён')
      } else {
        await api.post('/candidates', values)
        message.success('Кандидат добавлен')
      }
      setModalOpen(false)
      form.resetFields()
      fetchData()
    } catch (err) {
      message.error(err.response?.data?.message || 'Ошибка сохранения')
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/candidates/${id}`)
      message.success('Кандидат удалён')
      fetchData()
    } catch (err) {
      message.error(err.response?.data?.message || 'Ошибка удаления')
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: 'Имя', dataIndex: 'name', render: (v, r) => <a onClick={() => openEdit(r)}>{v}</a> },
    { title: 'Email', dataIndex: 'email', render: v => v || '—' },
    { title: 'Телефон', dataIndex: 'phone', render: v => v || '—' },
    {
      title: 'Источник',
      dataIndex: 'source',
      width: 110,
      render: v => <Tag color={v === 'internal' ? 'green' : 'blue'}>{v === 'internal' ? 'Внутренний' : 'Внешний'}</Tag>
    },
    { title: 'Должность', dataIndex: 'current_position', render: v => v || '—' },
    { title: 'Опыт (лет)', dataIndex: 'experience_years', width: 110 },
    {
      title: 'Добавлен',
      dataIndex: 'created_at',
      width: 110,
      render: v => dayjs(v).format('DD.MM.YYYY')
    },
    {
      title: 'Действия',
      width: 100,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Popconfirm
            title="Удалить кандидата?"
            onConfirm={() => handleDelete(record.id)}
            okText="Да"
            cancelText="Нет"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ]

  if (user?.role !== 'hr_manager') {
    return (
      <div>
        <Title level={3}>Кандидаты</Title>
        <p>Эта страница доступна только HR менеджерам.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <Title level={3} style={{ margin: 0 }}>Кандидаты</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>Обновить</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Добавить кандидата</Button>
        </Space>
      </div>

      <div className="filter-row">
        <Select
          allowClear
          placeholder="Источник"
          style={{ width: 160 }}
          value={filters.source || undefined}
          onChange={v => setFilters(prev => ({ ...prev, source: v || '' }))}
        >
          <Option value="external">Внешний</Option>
          <Option value="internal">Внутренний</Option>
        </Select>
        <Input.Search
          placeholder="Поиск по имени или email"
          style={{ width: 260 }}
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
          showTotal: total => `Всего: ${total}`,
          onChange: (page, pageSize) => fetchData(page, pageSize)
        }}
        size="small"
        style={{ background: '#fff', borderRadius: 8 }}
      />

      <Modal
        title={editRecord ? 'Редактировать кандидата' : 'Добавить кандидата'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        onOk={() => form.submit()}
        width={560}
        okText={editRecord ? 'Сохранить' : 'Добавить'}
        cancelText="Отмена"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="ФИО" rules={[{ required: true, message: 'Введите ФИО' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Некорректный email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Телефон">
            <Input placeholder="+7-999-000-0000" />
          </Form.Item>
          <Form.Item name="source" label="Источник" initialValue="external">
            <Select>
              <Option value="external">Внешний</Option>
              <Option value="internal">Внутренний</Option>
            </Select>
          </Form.Item>
          <Form.Item name="current_position" label="Текущая должность">
            <Input />
          </Form.Item>
          <Form.Item name="experience_years" label="Опыт (лет)" initialValue={0}>
            <InputNumber min={0} max={50} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="resume_text" label="Резюме / Заметки">
            <TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
