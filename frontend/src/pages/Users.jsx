import React, { useState, useEffect } from 'react'
import { Table, Tag, Typography, Button, Space, message } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import api from '../api'
import { useAuth } from '../context/AuthContext'

const { Title } = Typography

const ROLE_LABELS = {
  hr_director: 'HR Директор',
  hr_manager: 'HR Менеджер',
  functional_manager: 'Рук. отдела'
}

const ROLE_COLORS = {
  hr_director: 'purple',
  hr_manager: 'blue',
  functional_manager: 'green'
}

export default function UsersPage() {
  const { user } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await api.get('/users')
      setData(res.data.data || [])
    } catch {
      message.error('Ошибка загрузки пользователей')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: 'Имя', dataIndex: 'name' },
    { title: 'Email', dataIndex: 'email' },
    {
      title: 'Роль',
      dataIndex: 'role',
      width: 160,
      render: r => <Tag color={ROLE_COLORS[r]}>{ROLE_LABELS[r]}</Tag>
    },
    { title: 'Отдел', dataIndex: 'department', render: v => v || '—' },
    {
      title: 'Создан',
      dataIndex: 'created_at',
      width: 120,
      render: v => dayjs(v).format('DD.MM.YYYY')
    }
  ]

  if (user?.role !== 'hr_director') {
    return (
      <div>
        <Title level={3}>Пользователи</Title>
        <p>Эта страница доступна только HR директору.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <Title level={3} style={{ margin: 0 }}>Пользователи системы</Title>
        <Button icon={<ReloadOutlined />} onClick={fetchData}>Обновить</Button>
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
    </div>
  )
}
