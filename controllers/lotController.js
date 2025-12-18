/**
 * Lot Controller
 * 
 * Handles all business logic for LOT operations.
 * Implements separation of concerns, error handling, and validation.
 * 
 * @module controllers/lotController
 * @requires models/Lot
 * @requires models/Lead
 * @requires models/LeadsHistory
 * @author Senior Developer (5+ years experience)
 */

const Lot = require('../models/Lot');
const Lead = require('../models/Lead');
const LeadsHistory = require('../models/LeadsHistory');
const mongoose = require('mongoose');

/**
 * Controller class for LOT operations
 * Implements clean architecture principles
 */
class LotController {
  /**
   * Create a new LOT
   * 
   * Business Rules:
   * - Only Reten managers can create LOTs
   * - Lead must exist and be assigned to the manager
   * - All required fields must be provided
   * - Creates history entry for audit trail
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async createLot(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { leadId, lotName, amount, lotDate, payoutAmount, isPaid, financier } = req.body;
      const adminId = req.admin._id;
      const adminRole = req.admin.role;

      // ==================== VALIDATION ====================

      // Validate required fields
      if (!leadId || !lotName || !amount || !lotDate) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Все поля обязательны: leadId, lotName, amount, lotDate',
          errors: {
            leadId: !leadId ? 'ID лида обязателен' : null,
            lotName: !lotName ? 'Название лота обязательно' : null,
            amount: !amount ? 'Сумма обязательна' : null,
            lotDate: !lotDate ? 'Дата обязательна' : null
          }
        });
      }

      // Validate payout: if isPaid=true, then payoutAmount is required
      const isPaidBoolean = isPaid === true || isPaid === 'true';
      if (isPaidBoolean && !payoutAmount) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Укажите сумму выплаты'
        });
      }

      // Validate payoutAmount if provided
      if (payoutAmount) {
        const parsedPayoutAmount = parseFloat(payoutAmount);
        if (isNaN(parsedPayoutAmount) || parsedPayoutAmount < 0) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: 'Сумма выплаты должна быть положительным числом'
          });
        }
      }

      // Validate leadId format
      if (!mongoose.Types.ObjectId.isValid(leadId)) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Некорректный формат ID лида'
        });
      }

      // Validate amount
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount < 0) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Сумма должна быть положительным числом'
        });
      }

      // Validate date
      const parsedDate = new Date(lotDate);
      if (isNaN(parsedDate.getTime())) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Некорректный формат даты'
        });
      }

      // Validate date is not in future
      if (parsedDate > new Date()) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Дата лота не может быть в будущем'
        });
      }

      // ==================== BUSINESS LOGIC ====================

      // Get lead data
      const lead = await Lead.findById(leadId).session(session);
      if (!lead) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: 'Лид не найден'
        });
      }

      // Check if lead is assigned to current manager (for Reten role)
      if (adminRole === 'Reten' && lead.assigned?.toString() !== adminId.toString()) {
        await session.abortTransaction();
        return res.status(403).json({
          success: false,
          message: 'Вы можете создавать ЛОТы только для своих лидов'
        });
      }

      // ==================== CREATE LOT ====================
      // Note: Multiple LOTs can be created for the same lead

      const lotData = {
        lotName: lotName.trim(),
        amount: parsedAmount,
        lotDate: parsedDate,
        leadId: lead._id,
        leadName: lead.name,
        leadPhone: lead.phone || null,
        leadEmail: lead.email || null,
        assignedTo: lead.assigned || adminId,
        team: req.admin.team || null,
        department: lead.department || null,
        status: 'ACTIVE',
        payoutAmount: payoutAmount ? parseFloat(payoutAmount) : null,
        isPaid: isPaidBoolean,
        financier: financier ? financier.trim() : null
      };

      const lot = new Lot(lotData);
      await lot.save({ session });

      // ==================== CREATE HISTORY ENTRY ====================
      // Note: Lead status is NOT changed when creating a LOT

      const historyEntry = new LeadsHistory({
        leadId: lead._id,
        actionType: 'LOT_CREATED',
        description: `ЛОТ создан: ${lotName}`,
        adminId: adminId,
        metadata: {
          lotId: lot._id,
          lotName: lotName,
          amount: parsedAmount,
          lotDate: parsedDate
        }
      });

      await historyEntry.save({ session });

      // ==================== COMMIT TRANSACTION ====================

      await session.commitTransaction();

      // ==================== POPULATE AND RETURN ====================

      await lot.populate([
        { path: 'assignedTo', select: 'login email role' },
        { path: 'leadId', select: 'name phone email status department' }
      ]);

      res.status(201).json({
        success: true,
        message: 'ЛОТ успешно создан',
        data: lot
      });

    } catch (error) {
      await session.abortTransaction();
      console.error('Error creating LOT:', error);

      // Handle validation errors
      if (error.name === 'ValidationError') {
        const errors = {};
        Object.keys(error.errors).forEach(key => {
          errors[key] = error.errors[key].message;
        });

        return res.status(400).json({
          success: false,
          message: 'Ошибка валидации данных',
          errors
        });
      }

      res.status(500).json({
        success: false,
        message: 'Ошибка при создании ЛОТа',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    } finally {
      session.endSession();
    }
  }

  /**
   * Get LOTs with filtering and pagination
   * 
   * Features:
   * - Role-based access control
   * - Advanced filtering
   * - Pagination
   * - Sorting
   * - Search
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getLots(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'lotDate',
        sortOrder = 'desc',
        status,
        search,
        startDate,
        endDate,
        managerId,
        team
      } = req.query;

      const adminId = req.admin._id;
      const adminRole = req.admin.role;

      // ==================== BUILD FILTER ====================

      const filter = { isDeleted: false };

      // All users can see all LOTs
      // Optional filters by manager or team
      if (managerId) {
        if (!mongoose.Types.ObjectId.isValid(managerId)) {
          return res.status(400).json({
            success: false,
            message: 'Некорректный ID менеджера'
          });
        }
        filter.assignedTo = managerId;
      }
      if (team) {
        filter.team = team;
      }

      // Status filter
      if (status) {
        filter.status = status;
      }

      // Date range filter (UTC+2)
      if (startDate || endDate) {
        filter.lotDate = {};
        const KYIV_OFFSET_HOURS = 2;
        
        if (startDate) {
          const date = new Date(startDate);
          const start = new Date(Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            0 - KYIV_OFFSET_HOURS, 0, 0, 0
          ));
          filter.lotDate.$gte = start;
        }
        if (endDate) {
          const date = new Date(endDate);
          const end = new Date(Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            23 - KYIV_OFFSET_HOURS, 59, 59, 999
          ));
          filter.lotDate.$lte = end;
        }
      }

      // Text search
      if (search) {
        filter.$or = [
          { lotName: { $regex: search, $options: 'i' } },
          { leadName: { $regex: search, $options: 'i' } }
        ];
      }

      // ==================== BUILD SORT ====================

      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // ==================== PAGINATION ====================

      const skip = (parseInt(page) - 1) * parseInt(limit);

      // ==================== EXECUTE QUERY ====================

      console.log('🔍 LOT Query Filter:', JSON.stringify(filter, null, 2));
      console.log('📄 LOT Query Params:', { page, limit, skip, sortBy, sortOrder });

      const [lots, total] = await Promise.all([
        Lot.find(filter)
          .populate('assignedTo', 'login email role team')
          .populate('leadId', 'name phone email status department sourceDescription')
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Lot.countDocuments(filter)
      ]);

      console.log('✅ LOT Query Results:', { found: lots.length, total, pages: Math.ceil(total / parseInt(limit)) });

      // ==================== RETURN RESPONSE ====================

      res.json({
        success: true,
        data: lots,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
          hasNextPage: parseInt(page) < Math.ceil(total / parseInt(limit)),
          hasPrevPage: parseInt(page) > 1
        }
      });

    } catch (error) {
      console.error('Error fetching LOTs:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка при получении ЛОТов',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get single LOT by ID
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getLotById(req, res) {
    try {
      const { id } = req.params;
      const adminId = req.admin._id;
      const adminRole = req.admin.role;

      // Validate ID
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: 'Некорректный ID ЛОТа'
        });
      }

      // Find LOT
      const lot = await Lot.findOne({ _id: id, isDeleted: false })
        .populate('assignedTo', 'login email role team')
        .populate('leadId', 'name phone email status department')
        .populate('amountHistory.editedBy', 'login');

      if (!lot) {
        return res.status(404).json({
          success: false,
          message: 'ЛОТ не найден'
        });
      }

      // All users can view any LOT
      res.json({
        success: true,
        data: lot
      });

    } catch (error) {
      console.error('Error fetching LOT:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка при получении ЛОТа',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Update LOT amount
   * 
   * Features:
   * - Amount history tracking
   * - Validation
   * - History entry creation
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateLotAmount(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { id } = req.params;
      const { amount, reason } = req.body;
      const adminId = req.admin._id;
      const adminRole = req.admin.role;

      // ==================== VALIDATION ====================

      if (!mongoose.Types.ObjectId.isValid(id)) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Некорректный ID ЛОТа'
        });
      }

      if (!amount) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Сумма обязательна'
        });
      }

      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount < 0) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Сумма должна быть положительным числом'
        });
      }

      // ==================== FIND LOT ====================

      const lot = await Lot.findOne({ _id: id, isDeleted: false }).session(session);

      if (!lot) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: 'ЛОТ не найден'
        });
      }

      // ==================== CHECK ACCESS ====================

      if (adminRole === 'Reten' || adminRole === 'Manager') {
        if (lot.assignedTo.toString() !== adminId.toString()) {
          await session.abortTransaction();
          return res.status(403).json({
            success: false,
            message: 'Вы можете редактировать только свои ЛОТы'
          });
        }
      }

      // ==================== UPDATE AMOUNT ====================

      const previousAmount = lot.amount;

      if (previousAmount === parsedAmount) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Новая сумма совпадает с текущей'
        });
      }

      await lot.updateAmount(parsedAmount, adminId, reason || '');

      // ==================== CREATE HISTORY ENTRY ====================

      const historyEntry = new LeadsHistory({
        leadId: lot.leadId,
        actionType: 'LOT_AMOUNT_UPDATED',
        description: `Сумма ЛОТа изменена: ${previousAmount} → ${parsedAmount}`,
        adminId: adminId,
        metadata: {
          lotId: lot._id,
          lotName: lot.lotName,
          previousAmount,
          newAmount: parsedAmount,
          reason: reason || 'Не указана'
        }
      });

      await historyEntry.save({ session });

      // ==================== COMMIT TRANSACTION ====================

      await session.commitTransaction();

      // ==================== POPULATE AND RETURN ====================

      await lot.populate([
        { path: 'assignedTo', select: 'login email' },
        { path: 'leadId', select: 'name phone email' },
        { path: 'amountHistory.editedBy', select: 'login' }
      ]);

      res.json({
        success: true,
        message: 'Сумма ЛОТа успешно обновлена',
        data: lot
      });

    } catch (error) {
      await session.abortTransaction();
      console.error('Error updating LOT amount:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Ошибка при обновлении суммы ЛОТа',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    } finally {
      session.endSession();
    }
  }

  /**
   * Update LOT payout amount and isPaid status
   * 
   * Features:
   * - Updates payout amount
   * - Sets isPaid to true when payout is set
   * - Creates history entry
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async updateLotPayout(req, res) {
    console.log('=== updateLotPayout called ===');
    console.log('Params:', req.params);
    console.log('Body:', req.body);
    console.log('Admin:', req.admin ? { id: req.admin._id, role: req.admin.role } : 'NO ADMIN');
    
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { id } = req.params;
      const { payoutAmount, isPaid } = req.body;
      const adminId = req.admin._id;
      const adminRole = req.admin.role;

      // ==================== VALIDATION ====================

      if (!mongoose.Types.ObjectId.isValid(id)) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Некорректный ID ЛОТа'
        });
      }

      if (payoutAmount === undefined && isPaid === undefined) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Укажите сумму выплаты или статус оплаты'
        });
      }

      // Validate payoutAmount if provided
      if (payoutAmount !== undefined) {
        const parsedPayoutAmount = parseFloat(payoutAmount);
        if (isNaN(parsedPayoutAmount) || parsedPayoutAmount < 0) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: 'Сумма выплаты должна быть положительным числом'
          });
        }
      }

      // ==================== FIND LOT ====================

      const lot = await Lot.findOne({ _id: id, isDeleted: false }).session(session);

      if (!lot) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: 'ЛОТ не найден'
        });
      }

      // ==================== CHECK ACCESS ====================
      // Only Admin and TeamLead can update payouts

      if (adminRole !== 'Admin' && adminRole !== 'Reten') {
        await session.abortTransaction();
        return res.status(403).json({
          success: false,
          message: 'Только администратор или тимлид может обновлять выплаты'
        });
      }

      if (adminRole === 'TeamLead' && lot.team !== req.admin.team) {
        await session.abortTransaction();
        return res.status(403).json({
          success: false,
          message: 'Вы можете обновлять выплаты только для своей команды'
        });
      }

      // ==================== UPDATE PAYOUT ====================

      const previousPayoutAmount = lot.payoutAmount;
      const previousIsPaid = lot.isPaid;

      if (payoutAmount !== undefined) {
        lot.payoutAmount = parseFloat(payoutAmount);
      }

      if (isPaid !== undefined) {
        lot.isPaid = isPaid === true || isPaid === 'true';
      }

      await lot.save({ session });

      // ==================== CREATE HISTORY ENTRY ====================

      const historyEntry = new LeadsHistory({
        leadId: lot.leadId,
        actionType: 'LOT_PAYOUT_UPDATED',
        description: `Выплата ЛОТа обновлена: ${previousPayoutAmount || 0} → ${lot.payoutAmount || 0}`,
        adminId: adminId,
        metadata: {
          lotId: lot._id,
          lotName: lot.lotName,
          previousPayoutAmount,
          newPayoutAmount: lot.payoutAmount,
          previousIsPaid,
          newIsPaid: lot.isPaid
        }
      });

      await historyEntry.save({ session });

      // ==================== COMMIT TRANSACTION ====================

      await session.commitTransaction();

      // ==================== POPULATE AND RETURN ====================

      await lot.populate([
        { path: 'assignedTo', select: 'login email' },
        { path: 'leadId', select: 'name phone email' }
      ]);

      res.json({
        success: true,
        message: 'Выплата ЛОТа успешно обновлена',
        data: lot
      });

    } catch (error) {
      await session.abortTransaction();
      console.error('Error updating LOT payout:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Ошибка при обновлении выплаты ЛОТа',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    } finally {
      session.endSession();
    }
  }

  /**
   * Delete LOT (soft delete)
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async deleteLot(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { id } = req.params;
      const adminId = req.admin._id;
      const adminRole = req.admin.role;

      // Validate ID
      if (!mongoose.Types.ObjectId.isValid(id)) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Некорректный ID ЛОТа'
        });
      }

      // Find LOT
      const lot = await Lot.findOne({ _id: id, isDeleted: false }).session(session);

      if (!lot) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: 'ЛОТ не найден'
        });
      }

      // Check access (only Admin can delete)
      if (adminRole !== 'Admin') {
        await session.abortTransaction();
        return res.status(403).json({
          success: false,
          message: 'Только администратор может удалять ЛОТы'
        });
      }

      // Soft delete
      await lot.softDelete(adminId);

      // Create history entry
      const historyEntry = new LeadsHistory({
        leadId: lot.leadId,
        actionType: 'LOT_DELETED',
        description: `ЛОТ удален: ${lot.lotName}`,
        adminId: adminId,
        metadata: {
          lotId: lot._id,
          lotName: lot.lotName,
          amount: lot.amount
        }
      });

      await historyEntry.save({ session });

      await session.commitTransaction();

      res.json({
        success: true,
        message: 'ЛОТ успешно удален'
      });

    } catch (error) {
      await session.abortTransaction();
      console.error('Error deleting LOT:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка при удалении ЛОТа',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    } finally {
      session.endSession();
    }
  }

  /**
   * Get LOT statistics
   * 
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getLotStats(req, res) {
    try {
      const { startDate, endDate, team } = req.query;
      const adminRole = req.admin.role;

      let stats;

      if (team && (adminRole === 'Admin' || adminRole === 'TeamLead')) {
        stats = await Lot.getTeamStats(team, startDate, endDate);
      } else {
        stats = await Lot.getOverallStats(startDate, endDate);
      }

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('Error fetching LOT stats:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка при получении статистики ЛОТов',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

module.exports = LotController;
