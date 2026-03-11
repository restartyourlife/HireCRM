const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * @swagger
 * /classifiers:
 *   get:
 *     summary: Получить список классификаторов, сгруппированных по категориям
 *     tags: [Classifiers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Список классификаторов
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM requirement_classifiers ORDER BY category, name');
    const grouped = rows.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {});
    res.json({ success: true, data: rows, grouped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /classifiers:
 *   post:
 *     summary: Создать классификатор
 *     tags: [Classifiers]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', authenticate, authorize('hr_director', 'hr_manager'), async (req, res) => {
  try {
    const { category, name, description } = req.body;
    if (!category || !name) {
      return res.status(400).json({ success: false, message: 'Категория и название обязательны' });
    }
    const { rows } = await pool.query(
      'INSERT INTO requirement_classifiers (category, name, description) VALUES ($1, $2, $3) RETURNING *',
      [category, name, description]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /classifiers/{id}:
 *   get:
 *     summary: Получить классификатор по ID
 *     tags: [Classifiers]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM requirement_classifiers WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Классификатор не найден' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /classifiers/{id}:
 *   put:
 *     summary: Обновить классификатор
 *     tags: [Classifiers]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', authenticate, authorize('hr_director', 'hr_manager'), async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM requirement_classifiers WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ success: false, message: 'Классификатор не найден' });
    const c = existing[0];
    const { category, name, description } = req.body;
    const { rows } = await pool.query(
      'UPDATE requirement_classifiers SET category = $1, name = $2, description = $3 WHERE id = $4 RETURNING *',
      [category || c.category, name || c.name, description !== undefined ? description : c.description, req.params.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

/**
 * @swagger
 * /classifiers/{id}:
 *   delete:
 *     summary: Удалить классификатор
 *     tags: [Classifiers]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', authenticate, authorize('hr_director', 'hr_manager'), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM requirement_classifiers WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Классификатор не найден' });
    await pool.query('DELETE FROM requirement_classifiers WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Классификатор удалён' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
