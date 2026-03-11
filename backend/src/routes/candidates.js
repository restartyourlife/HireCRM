const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @swagger
 * /candidates:
 *   get:
 *     summary: Получить список кандидатов
 *     tags: [Candidates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { source, search, page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const params = [];
    const conditions = [];

    if (source) {
      params.push(source);
      conditions.push(`c.source = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`, `%${search}%`);
      conditions.push(`(c.name ILIKE $${params.length - 1} OR c.email ILIKE $${params.length})`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM candidates c ${where}`, params
    );
    const total = parseInt(countResult.rows[0].total);

    const listParams = [...params, parseInt(limit), offset];
    const { rows } = await pool.query(`
      SELECT c.*, u.name as creator_name
      FROM candidates c
      LEFT JOIN users u ON c.created_by = u.id
      ${where}
      ORDER BY c.created_at DESC
      LIMIT $${listParams.length - 1} OFFSET $${listParams.length}
    `, listParams);

    res.json({
      success: true,
      data: rows,
      pagination: { page: parseInt(page), limit: parseInt(limit), total }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /candidates:
 *   post:
 *     summary: Создать кандидата
 *     tags: [Candidates]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', authenticate, authorize('hr_manager'), async (req, res) => {
  try {
    const { name, email, phone, resume_text, source, current_position, experience_years } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Имя обязательно' });

    const { rows } = await pool.query(`
      INSERT INTO candidates (name, email, phone, resume_text, source, current_position, experience_years, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `, [name, email, phone, resume_text, source || 'external', current_position, experience_years || 0, req.user.id]);

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /candidates/{id}:
 *   get:
 *     summary: Получить кандидата по ID
 *     tags: [Candidates]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, u.name as creator_name
      FROM candidates c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Кандидат не найден' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /candidates/{id}:
 *   put:
 *     summary: Обновить кандидата
 *     tags: [Candidates]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', authenticate, authorize('hr_manager'), async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM candidates WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ success: false, message: 'Кандидат не найден' });
    const c = existing[0];
    const { name, email, phone, resume_text, source, current_position, experience_years } = req.body;

    const { rows } = await pool.query(`
      UPDATE candidates SET name = $1, email = $2, phone = $3, resume_text = $4,
      source = $5, current_position = $6, experience_years = $7, updated_at = CURRENT_TIMESTAMP
      WHERE id = $8 RETURNING *
    `, [
      name || c.name,
      email !== undefined ? email : c.email,
      phone !== undefined ? phone : c.phone,
      resume_text !== undefined ? resume_text : c.resume_text,
      source || c.source,
      current_position !== undefined ? current_position : c.current_position,
      experience_years !== undefined ? experience_years : c.experience_years,
      req.params.id
    ]);
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /candidates/{id}:
 *   delete:
 *     summary: Удалить кандидата
 *     tags: [Candidates]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', authenticate, authorize('hr_manager'), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM candidates WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Кандидат не найден' });
    await pool.query('DELETE FROM candidates WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Кандидат удалён' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
