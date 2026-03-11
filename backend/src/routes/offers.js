const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @swagger
 * /offers:
 *   get:
 *     summary: Получить список офферов
 *     tags: [Offers]
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
      conditions.push(`o.application_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`o.status = $${params.length}`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await pool.query(`SELECT COUNT(*) as total FROM offers o ${where}`, params);
    const total = parseInt(countResult.rows[0].total);

    const listParams = [...params, parseInt(limit), offset];
    const { rows } = await pool.query(`
      SELECT o.*, c.name as candidate_name, vr.title as vacancy_title
      FROM offers o
      LEFT JOIN applications a ON o.application_id = a.id
      LEFT JOIN candidates c ON a.candidate_id = c.id
      LEFT JOIN vacancy_requests vr ON a.vacancy_request_id = vr.id
      ${where}
      ORDER BY o.created_at DESC
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
 * /offers:
 *   post:
 *     summary: Создать оффер
 *     tags: [Offers]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', authenticate, authorize('hr_manager'), async (req, res) => {
  try {
    const { application_id, salary, additional_conditions } = req.body;
    if (!application_id || !salary) {
      return res.status(400).json({ success: false, message: 'application_id и salary обязательны' });
    }

    const { rows } = await pool.query(
      "INSERT INTO offers (application_id, salary, additional_conditions, status, created_by) VALUES ($1, $2, $3, 'prepared', $4) RETURNING *",
      [application_id, salary, additional_conditions, req.user.id]
    );
    await pool.query(
      'UPDATE applications SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['offer_prepared', application_id]
    );

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /offers/{id}:
 *   get:
 *     summary: Получить оффер по ID
 *     tags: [Offers]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT o.*, c.name as candidate_name, vr.title as vacancy_title
      FROM offers o
      LEFT JOIN applications a ON o.application_id = a.id
      LEFT JOIN candidates c ON a.candidate_id = c.id
      LEFT JOIN vacancy_requests vr ON a.vacancy_request_id = vr.id
      WHERE o.id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Оффер не найден' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /offers/{id}:
 *   put:
 *     summary: Обновить оффер
 *     tags: [Offers]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', authenticate, authorize('hr_manager'), async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM offers WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ success: false, message: 'Оффер не найден' });
    const o = existing[0];
    const { salary, additional_conditions } = req.body;

    const { rows } = await pool.query(
      'UPDATE offers SET salary = $1, additional_conditions = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [salary || o.salary, additional_conditions !== undefined ? additional_conditions : o.additional_conditions, req.params.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /offers/{id}/send:
 *   post:
 *     summary: Отправить оффер
 *     tags: [Offers]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/send', authenticate, authorize('hr_manager'), async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM offers WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ success: false, message: 'Оффер не найден' });

    const { rows } = await pool.query(
      "UPDATE offers SET status = 'sent', sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
      [req.params.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /offers/{id}/accept:
 *   post:
 *     summary: Принять оффер
 *     tags: [Offers]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/accept', authenticate, authorize('hr_manager'), async (req, res) => {
  try {
    const { response_notes } = req.body;
    const { rows: existing } = await pool.query('SELECT * FROM offers WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ success: false, message: 'Оффер не найден' });
    const offer = existing[0];

    const { rows } = await pool.query(
      'UPDATE offers SET status = $1, response_at = CURRENT_TIMESTAMP, response_notes = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      ['accepted', response_notes, req.params.id]
    );
    await pool.query(
      'UPDATE applications SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['offer_accepted', offer.application_id]
    );

    const { rows: appRows } = await pool.query('SELECT * FROM applications WHERE id = $1', [offer.application_id]);
    const { rows: candRows } = appRows[0] ? await pool.query('SELECT * FROM candidates WHERE id = $1', [appRows[0].candidate_id]) : { rows: [] };
    const { rows: vacRows } = appRows[0] ? await pool.query('SELECT * FROM vacancy_requests WHERE id = $1', [appRows[0].vacancy_request_id]) : { rows: [] };
    const candidate = candRows[0];
    const vacancy = vacRows[0];

    await pool.query(
      "INSERT INTO workplace_tasks (application_id, title, description, status, created_by) VALUES ($1, $2, $3, 'pending', $4)",
      [offer.application_id,
       `Подготовка рабочего места для ${candidate?.name || 'нового сотрудника'}`,
       `Оффер принят. Подготовить рабочее место для ${candidate?.name} на позиции ${vacancy?.title}.`,
       req.user.id]
    );

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /offers/{id}/decline:
 *   post:
 *     summary: Отклонить оффер
 *     tags: [Offers]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/decline', authenticate, authorize('hr_manager'), async (req, res) => {
  try {
    const { response_notes } = req.body;
    const { rows: existing } = await pool.query('SELECT * FROM offers WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ success: false, message: 'Оффер не найден' });
    const offer = existing[0];

    const { rows } = await pool.query(
      'UPDATE offers SET status = $1, response_at = CURRENT_TIMESTAMP, response_notes = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      ['declined', response_notes, req.params.id]
    );
    await pool.query(
      'UPDATE applications SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['offer_declined', offer.application_id]
    );

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
