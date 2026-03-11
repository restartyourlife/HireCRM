const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @swagger
 * /templates:
 *   get:
 *     summary: Получить список шаблонов
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Список шаблонов
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT t.*, u.name as creator_name
      FROM request_templates t
      LEFT JOIN users u ON t.created_by = u.id
      ORDER BY t.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /templates:
 *   post:
 *     summary: Создать шаблон
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', authenticate, authorize('functional_manager', 'hr_director'), async (req, res) => {
  try {
    const { name, description, requirements_json } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Название обязательно' });
    const { rows } = await pool.query(
      'INSERT INTO request_templates (name, description, requirements_json, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, description, JSON.stringify(requirements_json || []), req.user.id]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /templates/{id}:
 *   get:
 *     summary: Получить шаблон по ID
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT t.*, u.name as creator_name
      FROM request_templates t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Шаблон не найден' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /templates/{id}:
 *   put:
 *     summary: Обновить шаблон
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', authenticate, authorize('functional_manager', 'hr_director'), async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM request_templates WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ success: false, message: 'Шаблон не найден' });
    const t = existing[0];
    const { name, description, requirements_json } = req.body;
    const { rows } = await pool.query(
      'UPDATE request_templates SET name = $1, description = $2, requirements_json = $3 WHERE id = $4 RETURNING *',
      [name || t.name, description !== undefined ? description : t.description,
       requirements_json ? JSON.stringify(requirements_json) : t.requirements_json, req.params.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /templates/{id}:
 *   delete:
 *     summary: Удалить шаблон
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', authenticate, authorize('functional_manager', 'hr_director'), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM request_templates WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Шаблон не найден' });
    await pool.query('DELETE FROM request_templates WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Шаблон удалён' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
