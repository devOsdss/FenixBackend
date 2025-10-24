const express = require('express');
const router = express.Router();
const Lead = require('../../models/Lead');
const { authenticateToken } = require('../../middleware/auth');
const { logCommentAdded, logCommentEdited, logCommentDeleted } = require('../../utils/historyLogger');

// Add note to lead
router.post('/:id/notes', authenticateToken, async (req, res) => {
  try {
    const { note, photo, adminId, text } = req.body;
    const noteText = text || note; // Support both 'text' and 'note' parameters
    
    console.log('Add note request:', { leadId: req.params.id, noteText, photo, adminId });
    
    // Validate that either note or photo is provided
    if (!noteText && !photo) {
      return res.status(400).json({
        success: false,
        message: 'Необходимо предоставить текст заметки или фото'
      });
    }

    const lead = await Lead.findById(req.params.id);
    
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Лид не найден'
      });
    }

    // Create new note object
    const newNote = {
      text: noteText || '',
      photo: photo,
      createdAt: new Date(),
      adminId: adminId || req.admin._id
    };
    
    // Add note to lead's notes array
    lead.notes.push(newNote);
    lead.updatedByNote = noteText || 'Додано фото';
    lead.updatedAt = new Date();
    
    // Save the lead
    await lead.save();
    
    // Log comment addition to history
    if (newNote.adminId) {
      try {
        await logCommentAdded(lead._id, newNote.adminId, noteText || '', lead.name, photo);
      } catch (logError) {
        console.error('Error logging comment addition:', logError);
      }
    }
    
    res.json({
      success: true,
      message: 'Заметка успешно добавлена',
      data: lead
    });

  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при добавлении заметки'
    });
  }
});

// Edit note by index
router.put('/:id/notes/:noteIndex', authenticateToken, async (req, res) => {
  try {
    const { text, note, photo, adminId } = req.body;
    const noteText = text || note; // Support both 'text' and 'note' parameters
    const noteIndex = parseInt(req.params.noteIndex);
    
    console.log('Edit note request:', { leadId: req.params.id, noteIndex, noteText, photo });

    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Лид не найден'
      });
    }

    if (!lead.notes || noteIndex >= lead.notes.length || noteIndex < 0) {
      return res.status(404).json({
        success: false,
        message: 'Коментар не знайдено'
      });
    }

    // Store old note for history
    const oldNote = { ...lead.notes[noteIndex] };

    // Update the note
    lead.notes[noteIndex].text = noteText || '';
    if (photo !== undefined) {
      lead.notes[noteIndex].photo = photo;
    }
    lead.notes[noteIndex].updatedAt = new Date();
    
    lead.updatedAt = new Date();
    await lead.save();
    
    // Log comment edit to history
    if (adminId || req.admin._id) {
      try {
        await logCommentEdited(
          lead._id, 
          adminId || req.admin._id, 
          oldNote.text || '', 
          noteText || '', 
          lead.name
        );
      } catch (logError) {
        console.error('Error logging comment edit:', logError);
      }
    }
    
    res.json({
      success: true,
      message: 'Заметка успешно обновлена',
      data: lead
    });

  } catch (error) {
    console.error('Error editing note:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при редактировании заметки'
    });
  }
});

// Delete note by index
router.delete('/:id/notes/:noteIndex', authenticateToken, async (req, res) => {
  try {
    const noteIndex = parseInt(req.params.noteIndex);
    
    console.log('Delete note request:', { leadId: req.params.id, noteIndex });

    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Лид не найден'
      });
    }

    if (!lead.notes || noteIndex >= lead.notes.length || noteIndex < 0) {
      return res.status(404).json({
        success: false,
        message: 'Коментар не знайдено'
      });
    }

    // Store note info for history before deletion
    const deletedNote = lead.notes[noteIndex];
    
    // Remove the note
    lead.notes.splice(noteIndex, 1);
    lead.updatedAt = new Date();
    await lead.save();
    
    // Log comment deletion to history
    try {
      await logCommentDeleted(
        lead._id, 
        req.admin._id, 
        deletedNote.text || '', 
        lead.name
      );
    } catch (logError) {
      console.error('Error logging comment deletion:', logError);
    }
    
    res.json({
      success: true,
      message: 'Заметка успешно удалена',
      data: lead
    });

  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при удалении заметки'
    });
  }
});

module.exports = router;
