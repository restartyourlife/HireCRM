import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Modal, Form, Input, Select, Space, message,
  Typography, Popconfirm, Card, Tag, Divider
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons'
import api from '../../api'
import { useAuth } from '../../context/AuthContext'

const { Title } = Typography
const { Option } = Select

const CATEGORIES = ['Технические навыки', 'Soft skills', 'Образование', 'Опыт']
const CATEGORY_COLORS = {
  'Технические навыки': 'blue',
  'Soft skills': 'green',
  'Образование': 'purple',
  'Опыт': 'orange'
}

export default function ClassifiersPage() {
  const { user } = useAuth()
  const [data, setData] = useState([])
  const [grouped, setGrouped] = useState({})
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editRecord, setEditRecord] = useState(null)
  const [form] = Form.useForm()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/classifiers')
      setData(res.data.data || [])
      setGrouped(res.data.grouped || {})
    } catch {
      message.error('Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [])

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
        await api.put(`/classifiers/${editRecord.id}`, values)
        message.success('Классификатор обновлён')
      } else {
        await api.post('/classifiers', values)
        message.success('Классификатор создан')
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
      await api.delete(`/classifiers/${id}`)
      message.success('Классификатор удалён')
      fetchData()
    } catch (err) {
      message.error(err.response?.data?.message || 'Ошибка')
    }
  }

  const canEdit = user?.role === 'hr_director' || user?.role === 'hr_manager'

  return (
    <div>
      <div className="page-header">
        <Title level={3} style={{ margin: 0 }}>Классификаторы требований</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchData}>Обновить</Button>
          {canEdit && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Добавить
            </Button>
          )}
        </Space>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
        {Object.entries(grouped).map(([category, items]) => (
          <Card
            key={category}
            title={
              <Space>
                <Tag color={CATEGORY_COLORS[category] || 'default'}>{category}</Tag>
                <span style={{ fontSize: 12, color: '#888' }}>{items.length} элементов</span>
              </Space>
            }
            size="small"
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {items.map(item => (
                <Space key={item.id} size={4}>
                  <Tag
                    color={CATEGORY_COLORS[category]}
                    style={{ cursor: canEdit ? 'pointer' : 'default' }}
                    onClick={() => canEdit && openEdit(item)}
                  >
                    {item.name}
                  </Tag>
                  {canEdit && (
                    <Popconfirm
                      title="Удалить?"
                      onConfirm={() => handleDelete(item.id)}
                      okText="Да"
                      cancelText="Нет"
                    >
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} style={{ padding: 0, height: 20 }} />
                    </Popconfirm>
                  )}
                </Space>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {data.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Нет классификаторов</div>
      )}

      <Modal
        title={editRecord ? 'Редактировать классификатор' : 'Добавить классификатор'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        onOk={() => form.submit()}
        okText="Сохранить"
        cancelText="Отмена"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="category" label="Категория" rules={[{ required: true }]}>
            <Select placeholder="Выберите категорию" showSearch>
              {CATEGORIES.map(c => <Option key={c} value={c}>{c}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="name" label="Название" rules={[{ required: true }]}>
            <Input placeholder="Например: JavaScript, Лидерство..." />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
