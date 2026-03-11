const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @swagger
 * /requests:
 *   get:
 *     summary: Получить список заявок на вакансии
 *     tags: [Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: department
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
 *     responses:
 *       200:
 *         description: Список заявок
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, department, page = 1, limit = 10, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const params = [];
    const conditions = [];

    if (req.user.role === 'functional_manager') {
      params.push(req.user.id);
      conditions.push(`vr.created_by = $${params.length}`);
    } else if (req.user.role === 'hr_manager') {
      params.push(req.user.id);
      conditions.push(`vr.assigned_manager_id = $${params.length}`);
    }

    if (status) {
      params.push(status);
      conditions.push(`vr.status = $${params.length}`);
    }
    if (department) {
      params.push(`%${department}%`);
      conditions.push(`vr.department ILIKE $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`vr.title ILIKE $${params.length}`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM vacancy_requests vr ${where}`, params
    );
    const total = parseInt(countResult.rows[0].total);

    const listParams = [...params, parseInt(limit), offset];
    const { rows } = await pool.query(`
      SELECT vr.*, u1.name as creator_name, u2.name as manager_name
      FROM vacancy_requests vr
      LEFT JOIN users u1 ON vr.created_by = u1.id
      LEFT JOIN users u2 ON vr.assigned_manager_id = u2.id
      ${where}
      ORDER BY vr.created_at DESC
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
 * /requests:
 *   post:
 *     summary: Создать заявку на вакансию
 *     tags: [Requests]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *     responses:
 *       201:
 *         description: Заявка создана
 */
router.post('/', authenticate, authorize('functional_manager'), async (req, res) => {
  try {
    const { title, description, department, salary_from, salary_to, template_id, requirements_json } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Название обязательно' });

    const { rows } = await pool.query(`
      INSERT INTO vacancy_requests (title, description, department, salary_from, salary_to, status, created_by, template_id, requirements_json)
      VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7, $8) RETURNING *
    `, [title, description, department, salary_from, salary_to, req.user.id, template_id, JSON.stringify(requirements_json || [])]);

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /requests/{id}:
 *   get:
 *     summary: Получить заявку по ID
 *     tags: [Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Данные заявки
 *       404:
 *         description: Заявка не найдена
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT vr.*, u1.name as creator_name, u1.email as creator_email,
        u2.name as manager_name, u2.email as manager_email
      FROM vacancy_requests vr
      LEFT JOIN users u1 ON vr.created_by = u1.id
      LEFT JOIN users u2 ON vr.assigned_manager_id = u2.id
      WHERE vr.id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Заявка не найдена' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /requests/{id}:
 *   put:
 *     summary: Обновить заявку
 *     tags: [Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Заявка обновлена
 */
router.put('/:id', authenticate, authorize('functional_manager'), async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM vacancy_requests WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ success: false, message: 'Заявка не найдена' });
    const r = existing[0];
    if (r.created_by !== req.user.id) return res.status(403).json({ success: false, message: 'Нет доступа к этой заявке' });

    const { title, description, department, salary_from, salary_to, template_id, requirements_json } = req.body;
    const { rows } = await pool.query(`
      UPDATE vacancy_requests
      SET title = $1, description = $2, department = $3, salary_from = $4, salary_to = $5,
          template_id = $6, requirements_json = $7, updated_at = CURRENT_TIMESTAMP
      WHERE id = $8 RETURNING *
    `, [
      title || r.title,
      description !== undefined ? description : r.description,
      department || r.department,
      salary_from !== undefined ? salary_from : r.salary_from,
      salary_to !== undefined ? salary_to : r.salary_to,
      template_id !== undefined ? template_id : r.template_id,
      requirements_json ? JSON.stringify(requirements_json) : r.requirements_json,
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
 * /requests/{id}/submit:
 *   post:
 *     summary: Подать заявку (draft → pending_assignment)
 *     tags: [Requests]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/submit', authenticate, authorize('functional_manager'), async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM vacancy_requests WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ success: false, message: 'Заявка не найдена' });
    const r = existing[0];
    if (r.created_by !== req.user.id) return res.status(403).json({ success: false, message: 'Нет доступа' });
    if (r.status !== 'draft') return res.status(400).json({ success: false, message: 'Заявка не в статусе черновика' });

    const { rows } = await pool.query(
      'UPDATE vacancy_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['pending_assignment', req.params.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /requests/{id}/assign:
 *   post:
 *     summary: Назначить HR менеджера на заявку
 *     tags: [Requests]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/assign', authenticate, authorize('hr_director'), async (req, res) => {
  try {
    const { manager_id } = req.body;
    const { rows: existing } = await pool.query('SELECT * FROM vacancy_requests WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ success: false, message: 'Заявка не найдена' });
    if (!['pending_assignment', 'assigned'].includes(existing[0].status)) {
      return res.status(400).json({ success: false, message: 'Заявка не может быть назначена в текущем статусе' });
    }

    const { rows: managerRows } = await pool.query('SELECT * FROM users WHERE id = $1 AND role = $2', [manager_id, 'hr_manager']);
    if (!managerRows[0]) return res.status(400).json({ success: false, message: 'Указанный менеджер не найден или не является HR менеджером' });

    await pool.query(
      "UPDATE vacancy_requests SET assigned_manager_id = $1, status = 'assigned', updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [manager_id, req.params.id]
    );
    const { rows } = await pool.query(`
      SELECT vr.*, u1.name as creator_name, u2.name as manager_name
      FROM vacancy_requests vr
      LEFT JOIN users u1 ON vr.created_by = u1.id
      LEFT JOIN users u2 ON vr.assigned_manager_id = u2.id
      WHERE vr.id = $1
    `, [req.params.id]);
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /requests/{id}/request-clarification:
 *   post:
 *     summary: Запросить уточнение у функционального менеджера
 *     tags: [Requests]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/request-clarification', authenticate, authorize('hr_manager'), async (req, res) => {
  try {
    const { clarification_notes } = req.body;
    const { rows: existing } = await pool.query('SELECT * FROM vacancy_requests WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ success: false, message: 'Заявка не найдена' });
    const r = existing[0];
    if (r.assigned_manager_id !== req.user.id) return res.status(403).json({ success: false, message: 'Нет доступа' });
    if (!['assigned', 'in_progress'].includes(r.status)) {
      return res.status(400).json({ success: false, message: 'Нельзя запросить уточнение в текущем статусе' });
    }

    const { rows } = await pool.query(
      'UPDATE vacancy_requests SET status = $1, clarification_notes = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      ['clarification_requested', clarification_notes, req.params.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /requests/{id}/provide-clarification:
 *   post:
 *     summary: Предоставить уточнение
 *     tags: [Requests]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/provide-clarification', authenticate, authorize('functional_manager'), async (req, res) => {
  try {
    const { clarification_response } = req.body;
    const { rows: existing } = await pool.query('SELECT * FROM vacancy_requests WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ success: false, message: 'Заявка не найдена' });
    const r = existing[0];
    if (r.created_by !== req.user.id) return res.status(403).json({ success: false, message: 'Нет доступа' });
    if (r.status !== 'clarification_requested') return res.status(400).json({ success: false, message: 'Уточнение не запрошено' });

    const { rows } = await pool.query(
      'UPDATE vacancy_requests SET status = $1, clarification_response = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      ['clarification_provided', clarification_response, req.params.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /requests/{id}/accept:
 *   post:
 *     summary: Принять заявку в работу
 *     tags: [Requests]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/accept', authenticate, authorize('hr_manager'), async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM vacancy_requests WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ success: false, message: 'Заявка не найдена' });
    const r = existing[0];
    if (r.assigned_manager_id !== req.user.id) return res.status(403).json({ success: false, message: 'Нет доступа' });
    if (!['assigned', 'clarification_provided'].includes(r.status)) {
      return res.status(400).json({ success: false, message: 'Нельзя принять в работу в текущем статусе' });
    }

    const { rows } = await pool.query(
      'UPDATE vacancy_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['in_progress', req.params.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /requests/{id}/cancel:
 *   post:
 *     summary: Отменить заявку
 *     tags: [Requests]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/cancel', authenticate, async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM vacancy_requests WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ success: false, message: 'Заявка не найдена' });
    const r = existing[0];

    const canCancel = req.user.role === 'hr_director' ||
      (req.user.role === 'functional_manager' && r.created_by === req.user.id);
    if (!canCancel) return res.status(403).json({ success: false, message: 'Нет прав для отмены заявки' });
    if (r.status === 'cancelled') return res.status(400).json({ success: false, message: 'Заявка уже отменена' });

    const { rows } = await pool.query(
      'UPDATE vacancy_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['cancelled', req.params.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
