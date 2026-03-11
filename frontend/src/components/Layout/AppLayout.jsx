import React, { useState } from 'react'
import { Layout, Menu, Button, Avatar, Dropdown, Tag, Space, Typography } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  DashboardOutlined,
  FileTextOutlined,
  TeamOutlined,
  AppstoreOutlined,
  CalendarOutlined,
  SolutionOutlined,
  GiftOutlined,
  ToolOutlined,
  ProfileOutlined,
  TagsOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  CheckCircleOutlined
} from '@ant-design/icons'
import { useAuth } from '../../context/AuthContext'

const { Header, Sider, Content } = Layout
const { Text } = Typography

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

function getMenuItems(role) {
  const common = [
    { key: '/', icon: <DashboardOutlined />, label: 'Дашборд' }
  ]

  if (role === 'functional_manager') {
    return [
      ...common,
      { key: '/requests', icon: <FileTextOutlined />, label: 'Мои заявки' },
      { key: '/approvals', icon: <CheckCircleOutlined />, label: 'Согласования' },
      { key: '/templates', icon: <ProfileOutlined />, label: 'Шаблоны' },
      { key: '/classifiers', icon: <TagsOutlined />, label: 'Классификаторы' }
    ]
  }

  if (role === 'hr_director') {
    return [
      ...common,
      { key: '/requests', icon: <FileTextOutlined />, label: 'Все заявки' },
      { key: '/users', icon: <TeamOutlined />, label: 'Менеджеры' },
      { key: '/classifiers', icon: <TagsOutlined />, label: 'Классификаторы' }
    ]
  }

  if (role === 'hr_manager') {
    return [
      ...common,
      { key: '/requests', icon: <FileTextOutlined />, label: 'Заявки' },
      { key: '/candidates', icon: <TeamOutlined />, label: 'Кандидаты' },
      { key: '/applications', icon: <AppstoreOutlined />, label: 'Заявки на работу' },
      { key: '/interviews', icon: <CalendarOutlined />, label: 'Собеседования' },
      { key: '/test-assignments', icon: <SolutionOutlined />, label: 'Тестовые задания' },
      { key: '/offers', icon: <GiftOutlined />, label: 'Офферы' },
      { key: '/workplace-tasks', icon: <ToolOutlined />, label: 'Задачи по местам' }
    ]
  }

  return common
}

export default function AppLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const menuItems = getMenuItems(user?.role)

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Выйти',
      danger: true,
      onClick: () => {
        logout()
        navigate('/login')
      }
    }
  ]

  const selectedKey = menuItems.find(item => {
    if (item.key === '/') return location.pathname === '/'
    return location.pathname.startsWith(item.key)
  })?.key || '/'

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={240}
        style={{ background: '#001529' }}
      >
        <div className="app-logo">
          <span style={{ fontSize: 22 }}>H</span>
          {!collapsed && <span>HireCRM</span>}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header style={{
          padding: '0 24px',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #f0f0f0'
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: 18 }}
          />
          <Space>
            <Tag color={ROLE_COLORS[user?.role]}>{ROLE_LABELS[user?.role]}</Tag>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} style={{ background: '#1677ff' }} />
                <Text strong>{user?.name}</Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ margin: '24px', minHeight: 280 }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  )
}
