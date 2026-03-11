const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @swagger
 * /interviews:
 *   get:
 *     summary: Получить список собеседований
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { application_id, status, page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const params = [];
    const conditions = [];

    if (application_id) {
      params.push(application_id);
      conditions.push(`i.application_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`i.status = $${params.length}`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await pool.query(`SELECT COUNT(*) as total FROM interviews i ${where}`, params);
    const total = parseInt(countResult.rows[0].total);

    const listParams = [...params, parseInt(limit), offset];
    const { rows } = await pool.query(`
      SELECT i.*, c.name as candidate_name, vr.title as vacancy_title
      FROM interviews i
      LEFT JOIN applications a ON i.application_id = a.id
      LEFT JOIN candidates c ON a.candidate_id = c.id
      LEFT JOIN vacancy_requests vr ON a.vacancy_request_id = vr.id
      ${where}
      ORDER BY i.scheduled_at DESC
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
 * /interviews:
 *   post:
 *     summary: Создать собеседование
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', authenticate, authorize('hr_manager'), async (req, res) => {
  try {
    const { application_id, scheduled_at, duration_minutes, location, calendar_link, participants, notes, is_additional } = req.body;
    if (!application_id || !scheduled_at) {
      return res.status(400).json({ success: false, message: 'application_id и scheduled_at обязательны' });
    }

    const { rows: insertRows } = await pool.query(`
      INSERT INTO interviews (application_id, scheduled_at, duration_minutes, location, calendar_link, participants_json, notes, is_additional)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
    `, [application_id, scheduled_at, duration_minutes || 60, location, calendar_link,
        JSON.stringify(participants || []), notes, is_additional || false]);

    await pool.query(
      'UPDATE applications SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['interview_scheduled', application_id]
    );

    const { rows } = await pool.query(`
      SELECT i.*, c.name as candidate_name, vr.title as vacancy_title
      FROM interviews i
      LEFT JOIN applications a ON i.application_id = a.id
      LEFT JOIN candidates c ON a.candidate_id = c.id
      LEFT JOIN vacancy_requests vr ON a.vacancy_request_id = vr.id
      WHERE i.id = $1
    `, [insertRows[0].id]);

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /interviews/{id}:
 *   get:
 *     summary: Получить собеседование по ID
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT i.*, c.name as candidate_name, vr.title as vacancy_title
      FROM interviews i
      LEFT JOIN applications a ON i.application_id = a.id
      LEFT JOIN candidates c ON a.candidate_id = c.id
      LEFT JOIN vacancy_requests vr ON a.vacancy_request_id = vr.id
      WHERE i.id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Собеседование не найдено' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /interviews/{id}:
 *   put:
 *     summary: Обновить собеседование
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', authenticate, authorize('hr_manager'), async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM interviews WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ success: false, message: 'Собеседование не найдено' });
    const i = existing[0];
    const { scheduled_at, duration_minutes, location, calendar_link, participants, notes, status } = req.body;

    const { rows } = await pool.query(`
      UPDATE interviews
      SET scheduled_at = $1, duration_minutes = $2, location = $3, calendar_link = $4,
          participants_json = $5, notes = $6, status = $7, updated_at = CURRENT_TIMESTAMP
      WHERE id = $8 RETURNING *
    `, [
      scheduled_at || i.scheduled_at,
      duration_minutes !== undefined ? duration_minutes : i.duration_minutes,
      location !== undefined ? location : i.location,
      calendar_link !== undefined ? calendar_link : i.calendar_link,
      participants ? JSON.stringify(participants) : i.participants_json,
      notes !== undefined ? notes : i.notes,
      status || i.status,
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
 * /interviews/{id}/cancel:
 *   post:
 *     summary: Отменить собеседование
 *     tags: [Interviews]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/cancel', authenticate, authorize('hr_manager'), async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM interviews WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ success: false, message: 'Собеседование не найдено' });

    const { rows } = await pool.query(
      'UPDATE interviews SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['cancelled', req.params.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
