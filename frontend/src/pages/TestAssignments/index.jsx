import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Modal, Form, Input, Select, Tag, Space, message,
  Typography, InputNumber, DatePicker
} from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import api from '../../api'
import { useAuth } from '../../context/AuthContext'

const { Title, Text } = Typography
const { TextArea } = Input
const { Option } = Select

const STATUS_LABELS = {
  assigned: 'Выдано',
  submitted: 'Сдано',
  evaluated: 'Оценено'
}

const STATUS_COLORS = {
  assigned: 'blue',
  submitted: 'orange',
  evaluated: 'green'
}

export default function TestAssignmentsPage() {
  const { user } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [filters, setFilters] = useState({ status: '' })
  const [submitModal, setSubmitModal] = useState(false)
  const [evaluateModal, setEvaluateModal] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [submitForm] = Form.useForm()
  const [evaluateForm] = Form.useForm()

  const fetchData = useCallback(async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const params = { page, limit: pageSize }
      if (filters.status) params.status = filters.status
      const res = await api.get('/test-assignments', { params })
      setData(res.data.data || [])
      setPagination(prev => ({ ...prev, current: page, pageSize, total: res.data.pagination?.total || 0 }))
    } catch {
      message.error('Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSubmit = async (values) => {
    try {
      await api.post(`/test-assignments/${selectedRecord.id}/submit`, values)
      message.success('Задание отмечено как сданное')
      setSubmitModal(false)
      submitForm.resetFields()
      fetchData()
    } catch (err) {
      message.error(err.response?.data?.message || 'Ошибка')
    }
  }

  const handleEvaluate = async (values) => {
    try {
      await api.post(`/test-assignments/${selectedRecord.id}/evaluate`, values)
      message.success('Оценка выставлена')
      setEvaluateModal(false)
      evaluateForm.resetFields()
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
      title: 'Описание',
      dataIndex: 'description',
      render: v => v?.length > 60 ? v.substring(0, 60) + '...' : v
    },
    {
      title: 'Дедлайн',
      dataIndex: 'deadline',
      width: 120,
      render: v => v ? dayjs(v).format('DD.MM.YYYY') : '—'
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      width: 120,
      render: s => <Tag color={STATUS_COLORS[s]}>{STATUS_LABELS[s]}</Tag>
    },
    {
      title: 'Оценка',
      dataIndex: 'evaluation_score',
      width: 90,
      render: v => v !== null && v !== undefined ? `${v}/100` : '—'
    },
    {
      title: 'Действия',
      width: 160,
      render: (_, r) => (
        <Space>
          {user?.role === 'hr_manager' && r.status === 'assigned' && (
            <Button size="small" onClick={() => { setSelectedRecord(r); setSubmitModal(true) }}>
              Отметить сданным
            </Button>
          )}
          {user?.role === 'functional_manager' && r.status === 'submitted' && (
            <Button size="small" type="primary" onClick={() => { setSelectedRecord(r); setEvaluateModal(true) }}>
              Оценить
            </Button>
          )}
        </Space>
      )
    }
  ]

  const defaultStatus = user?.role === 'functional_manager' ? 'submitted' : ''

  return (
    <div>
      <div className="page-header">
        <Title level={3} style={{ margin: 0 }}>Тестовые задания</Title>
        <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>Обновить</Button>
      </div>

      <div className="filter-row">
        <Select
          allowClear
          placeholder="Статус"
          style={{ width: 160 }}
          value={filters.status || undefined}
          onChange={v => setFilters({ status: v || '' })}
          defaultValue={defaultStatus || undefined}
        >
          <Option value="assigned">Выдано</Option>
          <Option value="submitted">Сдано (ожидает оценки)</Option>
          <Option value="evaluated">Оценено</Option>
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
        title="Отметить ТЗ сданным"
        open={submitModal}
        onCancel={() => { setSubmitModal(false); submitForm.resetFields() }}
        onOk={() => submitForm.submit()}
        okText="Отметить"
        cancelText="Отмена"
      >
        <Form form={submitForm} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="submission_notes" label="Примечания">
            <TextArea rows={3} placeholder="Дополнительные заметки о сдаче..." />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Оценить тестовое задание"
        open={evaluateModal}
        onCancel={() => { setEvaluateModal(false); evaluateForm.resetFields() }}
        onOk={() => evaluateForm.submit()}
        okText="Сохранить оценку"
        cancelText="Отмена"
      >
        {selectedRecord && (
          <div style={{ marginBottom: 16, padding: 12, background: '#f6f8ff', borderRadius: 6 }}>
            <Text strong>Кандидат: </Text><Text>{selectedRecord.candidate_name}</Text><br />
            <Text strong>Задание: </Text><Text>{selectedRecord.description}</Text>
          </div>
        )}
        <Form form={evaluateForm} layout="vertical" onFinish={handleEvaluate}>
          <Form.Item name="evaluation_score" label="Оценка (0-100)" rules={[{ required: true }]}>
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="evaluator_comment" label="Комментарий" rules={[{ required: true }]}>
            <TextArea rows={4} placeholder="Опишите результаты выполнения задания..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
