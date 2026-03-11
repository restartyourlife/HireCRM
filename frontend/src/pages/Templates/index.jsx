import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Modal, Form, Input, Select, Space, message,
  Typography, Popconfirm, Tag
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import api from '../../api'
import { useAuth } from '../../context/AuthContext'

const { Title, Text } = Typography
const { TextArea } = Input

export default function TemplatesPage() {
  const { user } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState(null)
  const [classifiers, setClassifiers] = useState([])
  const [form] = Form.useForm()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/templates')
      setData(res.data.data || [])
    } catch {
      message.error('Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    api.get('/classifiers').then(res => setClassifiers(res.data.data || [])).catch(() => {})
  }, [])

  const openCreate = () => {
    setEditRecord(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (record) => {
    setEditRecord(record)
    try {
      form.setFieldsValue({
        ...record,
        requirements_json: JSON.parse(record.requirements_json || '[]')
      })
    } catch {
      form.setFieldsValue({ ...record, requirements_json: [] })
    }
    setModalOpen(true)
  }

  const handleSubmit = async (values) => {
    try {
      if (editRecord) {
        await api.put(`/templates/${editRecord.id}`, values)
        message.success('Шаблон обновлён')
      } else {
        await api.post('/templates', values)
        message.success('Шаблон создан')
      }
      setModalOpen(false)
      form.resetFields()
      fetchData()
    } catch (err) {
      message.error(err.response?.data?.message || 'Ошибка')
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/templates/${id}`)
      message.success('Шаблон удалён')
      fetchData()
    } catch (err) {
      message.error(err.response?.data?.message || 'Ошибка')
    }
  }

  const requirementOptions = classifiers.map(c => ({ label: c.name, value: c.name }))

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: 'Название', dataIndex: 'name', render: (v, r) => <a onClick={() => openEdit(r)}>{v}</a> },
    { title: 'Описание', dataIndex: 'description', render: v => v || '—' },
    {
      title: 'Требования',
      dataIndex: 'requirements_json',
      render: v => {
        try {
          const reqs = JSON.parse(v || '[]')
          return reqs.map(r => <Tag key={r} style={{ marginBottom: 2 }}>{r}</Tag>)
        } catch {
          return '—'
        }
      }
    },
    { title: 'Создал', dataIndex: 'creator_name', render: v => v || '—' },
    {
      title: 'Создан',
      dataIndex: 'created_at',
      width: 110,
      render: v => dayjs(v).format('DD.MM.YYYY')
    },
    {
      title: 'Действия',
      width: 100,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm
            title="Удалить шаблон?"
            onConfirm={() => handleDelete(r.id)}
            okText="Да"
            cancelText="Нет"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div>
      <div className="page-header">
        <Title level={3} style={{ margin: 0 }}>Шаблоны заявок</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchData}>Обновить</Button>
          {(user?.role === 'functional_manager' || user?.role === 'hr_director') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Создать шаблон
            </Button>
          )}
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{ showSizeChanger: true }}
        size="small"
        style={{ background: '#fff', borderRadius: 8 }}
      />

      <Modal
        title={editRecord ? 'Редактировать шаблон' : 'Создать шаблон'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        onOk={() => form.submit()}
        width={560}
        okText="Сохранить"
        cancelText="Отмена"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="Название шаблона" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="requirements_json" label="Требования">
            <Select
              mode="tags"
              placeholder="Добавьте требования из списка или введите свои"
              options={requirementOptions}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
