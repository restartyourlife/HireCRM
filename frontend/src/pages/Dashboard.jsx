import React, { useState, useEffect } from 'react'
import { Row, Col, Card, Statistic, Typography, List, Tag, Spin, Empty } from 'antd'
import {
  FileTextOutlined, TeamOutlined, CalendarOutlined,
  AppstoreOutlined, ClockCircleOutlined, CheckCircleOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import api from '../api'
import { useAuth } from '../context/AuthContext'

const { Title, Text } = Typography

const STATUS_LABELS = {
  draft: 'Черновик',
  pending_assignment: 'Ожидает назначения',
  assigned: 'Назначена',
  clarification_requested: 'Запрошено уточнение',
  clarification_provided: 'Уточнение предоставлено',
  in_progress: 'В работе',
  completed: 'Завершена',
  cancelled: 'Отменена',
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
  draft: 'default',
  pending_assignment: 'orange',
  assigned: 'blue',
  clarification_requested: 'red',
  clarification_provided: 'cyan',
  in_progress: 'processing',
  completed: 'green',
  cancelled: 'default',
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

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({})
  const [recentRequests, setRecentRequests] = useState([])
  const [recentApps, setRecentApps] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reqRes, appRes] = await Promise.all([
          api.get('/requests?limit=5'),
          api.get('/applications?limit=5')
        ])
        const requests = reqRes.data.data || []
        const applications = appRes.data.data || []

        setRecentRequests(requests)
        setRecentApps(applications)

        const statsData = {
          totalRequests: reqRes.data.pagination?.total || requests.length,
          totalApps: appRes.data.pagination?.total || applications.length,
          activeRequests: requests.filter(r => ['assigned', 'in_progress'].includes(r.status)).length,
          pendingApproval: applications.filter(a => a.status === 'pending_candidate_approval').length
        }

        if (user?.role === 'hr_manager') {
          try {
            const [intRes, taskRes] = await Promise.all([
              api.get('/interviews?status=scheduled'),
              api.get('/workplace-tasks?status=pending')
            ])
            statsData.scheduledInterviews = intRes.data.pagination?.total || 0
            statsData.pendingTasks = taskRes.data.pagination?.total || 0
          } catch {}
        }

        setStats(statsData)
      } catch (err) {
        console.error('Dashboard fetch error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user])

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  }

  return (
    <div>
      <Title level={2} style={{ marginBottom: 24 }}>
        Добро пожаловать, {user?.name}!
      </Title>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Заявок на вакансии"
              value={stats.totalRequests || 0}
              prefix={<FileTextOutlined style={{ color: '#1677ff' }} />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Активных заявок"
              value={stats.activeRequests || 0}
              prefix={<ClockCircleOutlined style={{ color: '#fa8c16' }} />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Заявок на работу"
              value={stats.totalApps || 0}
              prefix={<AppstoreOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={user?.role === 'hr_manager' ? 'Запланировано собеседований' : 'Ожидают согласования'}
              value={user?.role === 'hr_manager' ? (stats.scheduledInterviews || 0) : (stats.pendingApproval || 0)}
              prefix={user?.role === 'hr_manager' ? <CalendarOutlined style={{ color: '#722ed1' }} /> : <CheckCircleOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Последние заявки на вакансии" size="small">
            {recentRequests.length === 0 ? (
              <Empty description="Нет заявок" />
            ) : (
              <List
                size="small"
                dataSource={recentRequests}
                renderItem={item => (
                  <List.Item>
                    <List.Item.Meta
                      title={item.title}
                      description={
                        <span>
                          {item.department && <Text type="secondary">{item.department} · </Text>}
                          <Text type="secondary">{dayjs(item.created_at).format('DD.MM.YYYY')}</Text>
                        </span>
                      }
                    />
                    <Tag color={STATUS_COLORS[item.status]}>{STATUS_LABELS[item.status]}</Tag>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Последние заявки на работу" size="small">
            {recentApps.length === 0 ? (
              <Empty description="Нет заявок" />
            ) : (
              <List
                size="small"
                dataSource={recentApps}
                renderItem={item => (
                  <List.Item>
                    <List.Item.Meta
                      title={item.candidate_name || 'Кандидат'}
                      description={
                        <Text type="secondary">{item.vacancy_title}</Text>
                      }
                    />
                    <Tag color={STATUS_COLORS[item.status]}>{STATUS_LABELS[item.status]}</Tag>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
