import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Modal, Form, Input, Tag, Space, message,
  Typography, Tabs, InputNumber
} from 'antd'
import dayjs from 'dayjs'
import api from '../api'
import { useAuth } from '../context/AuthContext'

const { Title } = Typography
const { TextArea } = Input

const STATUS_LABELS = {
  pending_candidate_approval: 'Ожидает согласования',
  test_submitted: 'ТЗ ожидает оценки'
}

export default function ApprovalsPage() {
  const { user } = useAuth()
  const [pendingApps, setPendingApps] = useState([])
  const [testApps, setTestApps] = useState([])
  const [loading, setLoading] = useState(false)
  const [actionModal, setActionModal] = useState({ open: false, type: '', record: null, title: '' })
  const [form] = Form.useForm()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [approvalRes, testRes] = await Promise.all([
        api.get('/applications?status=pending_candidate_approval&limit=50'),
        api.get('/test-assignments?status=submitted&limit=50')
      ])
      setPendingApps(approvalRes.data.data || [])
      setTestApps(testRes.data.data || [])
    } catch {
      message.error('Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const doAction = async (type, values = {}) => {
    const record = actionModal.record
    try {
      if (type === 'approve') {
        await api.post(`/applications/${record.id}/approve-candidate`, values)
        message.success('Кандидат согласован')
      } else if (type === 'reject') {
        await api.post(`/applications/${record.id}/reject`, values)
        message.success('Отклонено')
      } else if (type === 'evaluate') {
        await api.post(`/test-assignments/${record.id}/evaluate`, values)
        message.success('Оценка выставлена')
      }
      setActionModal({ open: false, type: '', record: null, title: '' })
      form.resetFields()
      fetchData()
    } catch (err) {
      message.error(err.response?.data?.message || 'Ошибка')
    }
  }

  const appColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: 'Кандидат', dataIndex: 'candidate_name' },
    { title: 'Вакансия', dataIndex: 'vacancy_title' },
    {
      title: 'Статус',
      dataIndex: 'status',
      width: 200,
      render: s => <Tag color="orange">{STATUS_LABELS[s] || s}</Tag>
    },
    {
      title: 'Дата',
      dataIndex: 'updated_at',
      width: 110,
      render: v => dayjs(v).format('DD.MM.YYYY')
    },
    {
      title: 'Действия',
      width: 180,
      render: (_, r) => (
        <Space>
          <Button
            size="small"
            type="primary"
            onClick={() => {
              setActionModal({ open: true, type: 'approve', record: r, title: `Согласовать кандидата: ${r.candidate_name}` })
              form.resetFields()
            }}
          >
            Согласовать
          </Button>
          <Button
            size="small"
            danger
            onClick={() => {
              setActionModal({ open: true, type: 'reject', record: r, title: 'Отклонить кандидата' })
              form.resetFields()
            }}
          >
            Отклонить
          </Button>
        </Space>
      )
    }
  ]

  const testColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: 'Кандидат', dataIndex: 'candidate_name' },
    { title: 'Вакансия', dataIndex: 'vacancy_title' },
    {
      title: 'Задание',
      dataIndex: 'description',
      render: v => v?.length > 80 ? v.substring(0, 80) + '...' : v
    },
    {
      title: 'Сдано',
      dataIndex: 'submitted_at',
      width: 110,
      render: v => v ? dayjs(v).format('DD.MM.YYYY') : '—'
    },
    {
      title: 'Действия',
      width: 120,
      render: (_, r) => (
        <Button
          size="small"
          type="primary"
          onClick={() => {
            setActionModal({ open: true, type: 'evaluate', record: r, title: `Оценить ТЗ: ${r.candidate_name}` })
            form.resetFields()
          }}
        >
          Оценить
        </Button>
      )
    }
  ]

  if (user?.role !== 'functional_manager') {
    return (
      <div>
        <Title level={3}>Согласования</Title>
        <p>Эта страница доступна функциональным менеджерам.</p>
      </div>
    )
  }

  const items = [
    {
      key: 'approvals',
      label: `Согласования кандидатов (${pendingApps.length})`,
      children: (
        <Table
          columns={appColumns}
          dataSource={pendingApps}
          rowKey="id"
          loading={loading}
          size="small"
          style={{ background: '#fff', borderRadius: 8 }}
          pagination={{ showSizeChanger: true }}
        />
      )
    },
    {
      key: 'tests',
      label: `Тестовые задания на оценку (${testApps.length})`,
      children: (
        <Table
          columns={testColumns}
          dataSource={testApps}
          rowKey="id"
          loading={loading}
          size="small"
          style={{ background: '#fff', borderRadius: 8 }}
          pagination={{ showSizeChanger: true }}
        />
      )
    }
  ]

  return (
    <div>
      <div className="page-header">
        <Title level={3} style={{ margin: 0 }}>Согласования</Title>
        <Button onClick={fetchData}>Обновить</Button>
      </div>

      <Tabs items={items} />

      <Modal
        title={actionModal.title}
        open={actionModal.open}
        onCancel={() => { setActionModal({ open: false, type: '', record: null, title: '' }); form.resetFields() }}
        onOk={() => form.submit()}
        okText="Подтвердить"
        cancelText="Отмена"
      >
        <Form form={form} layout="vertical" onFinish={(v) => doAction(actionModal.type, v)}>
          {actionModal.type === 'approve' && (
            <Form.Item name="approval_comment" label="Комментарий">
              <TextArea rows={3} placeholder="Подтверждаю соответствие ожиданий по зарплате..." />
            </Form.Item>
          )}
          {actionModal.type === 'reject' && (
            <Form.Item name="rejection_reason" label="Причина отказа">
              <TextArea rows={3} />
            </Form.Item>
          )}
          {actionModal.type === 'evaluate' && (
            <>
              <Form.Item name="evaluation_score" label="Оценка (0-100)" rules={[{ required: true }]}>
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="evaluator_comment" label="Комментарий" rules={[{ required: true }]}>
                <TextArea rows={4} placeholder="Оцените качество выполнения задания..." />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </div>
  )
}
