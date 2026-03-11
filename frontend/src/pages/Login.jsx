import React, { useState } from 'react'
import { Form, Input, Button, Card, message, Typography } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const { Title, Text } = Typography

export default function Login() {
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const onFinish = async ({ email, password }) => {
    setLoading(true)
    try {
      await login(email, password)
      message.success('Добро пожаловать!')
      navigate('/')
    } catch (err) {
      message.error(err.response?.data?.message || 'Ошибка входа. Проверьте данные.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <Card className="login-card" bordered={false}>
        <div className="login-logo">
          <Title level={1} style={{ color: '#1677ff', margin: 0, fontWeight: 800 }}>HireCRM</Title>
          <Text type="secondary">Система управления подбором персонала</Text>
        </div>

        <Form
          name="login"
          onFinish={onFinish}
          size="large"
          layout="vertical"
        >
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Введите email' },
              { type: 'email', message: 'Некорректный email' }
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="Email адрес" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Пароль"
            rules={[{ required: true, message: 'Введите пароль' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Пароль" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={loading} block>
              Войти в систему
            </Button>
          </Form.Item>
        </Form>

        <div className="demo-hint">
          <strong>Демо-доступ:</strong>
          <p><b>HR Директор:</b> admin@hirecrm.ru / admin123</p>
          <p><b>HR Менеджер:</b> manager@hirecrm.ru / manager123</p>
          <p><b>Рук. отдела:</b> lead@hirecrm.ru / lead123</p>
        </div>
      </Card>
    </div>
  )
}
