const { query } = require('../config/database');

class SchedulingService {
  // Appointment Types Configuration
  getAppointmentTypes() {
    return [
      {
        type: 'site_visit',
        duration: 60, // minutes
        buffer_time: 15, // travel time
        max_per_day: 8,
        advance_booking: {
          min_hours: 2,
          max_days: 30
        },
        auto_confirmation: true,
        requires_deposit: false
      },
      {
        type: 'consultation_call',
        duration: 30,
        buffer_time: 0,
        max_per_day: 12,
        virtual_meeting: true,
        auto_send_meeting_link: true
      },
      {
        type: 'documentation_meeting',
        duration: 90,
        buffer_time: 0,
        requires: ['property_selected', 'documents_ready'],
        location: 'office'
      },
      {
        type: 'property_handover',
        duration: 120,
        buffer_time: 0,
        requires: ['payment_complete', 'all_documents_verified']
      }
    ];
  }

  // Get available time slots
  async getAvailableSlots(date, appointmentType = 'site_visit', agentId = null) {
    const appointmentConfig = this.getAppointmentTypes().find(type => type.type === appointmentType);
    if (!appointmentConfig) return [];

    const workingHours = this.getWorkingHours(date);
    if (!workingHours) return [];

    const existingAppointments = await this.getExistingAppointments(date, agentId);
    const slots = this.generateTimeSlots(date, workingHours, appointmentConfig);

    return slots.filter(slot => !this.isSlotBooked(slot, existingAppointments, appointmentConfig));
  }

  // Get working hours for a date
  getWorkingHours(date) {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Default working hours
    const defaultHours = {
      0: null, // Sunday - closed
      1: { start: '09:00', end: '18:00' }, // Monday
      2: { start: '09:00', end: '18:00' }, // Tuesday
      3: { start: '09:00', end: '18:00' }, // Wednesday
      4: { start: '09:00', end: '18:00' }, // Thursday
      5: { start: '09:00', end: '18:00' }, // Friday
      6: { start: '10:00', end: '16:00' }  // Saturday
    };

    return defaultHours[dayOfWeek];
  }

  // Generate time slots
  generateTimeSlots(date, workingHours, appointmentConfig) {
    const slots = [];
    const [startHour, startMinute] = workingHours.start.split(':').map(Number);
    const [endHour, endMinute] = workingHours.end.split(':').map(Number);

    const startTime = new Date(date);
    startTime.setHours(startHour, startMinute, 0, 0);

    const endTime = new Date(date);
    endTime.setHours(endHour, endMinute, 0, 0);

    const slotDuration = appointmentConfig.duration;
    const bufferTime = appointmentConfig.buffer_time;

    let currentTime = new Date(startTime);

    while (currentTime.getTime() + (slotDuration + bufferTime) * 60000 <= endTime.getTime()) {
      const slotEnd = new Date(currentTime.getTime() + slotDuration * 60000);

      slots.push({
        start: new Date(currentTime),
        end: slotEnd,
        duration: slotDuration,
        available: true
      });

      // Move to next slot with buffer
      currentTime = new Date(slotEnd.getTime() + bufferTime * 60000);
    }

    return slots;
  }

  // Get existing appointments for date
  async getExistingAppointments(date, agentId = null) {
    try {
      const dateStr = date.toISOString().split('T')[0];

      let queryText = `
        SELECT * FROM appointments
        WHERE DATE(scheduled_at) = $1 AND status != 'cancelled'
      `;
      const params = [dateStr];

      if (agentId) {
        queryText += ' AND agent_id = $2';
        params.push(agentId);
      }

      const result = await query(queryText, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting existing appointments:', error);
      return [];
    }
  }

  // Check if slot is booked
  isSlotBooked(slot, existingAppointments, appointmentConfig) {
    return existingAppointments.some(appointment => {
      const appointmentStart = new Date(appointment.scheduled_at);
      const appointmentEnd = new Date(appointmentStart.getTime() + appointment.duration_minutes * 60000);

      return (
        (slot.start >= appointmentStart && slot.start < appointmentEnd) ||
        (slot.end > appointmentStart && slot.end <= appointmentEnd) ||
        (slot.start <= appointmentStart && slot.end >= appointmentEnd)
      );
    });
  }

  // Book appointment
  async bookAppointment(appointmentData) {
    try {
      const {
        contactId,
        agentId,
        appointmentType,
        scheduledAt,
        propertyId,
        notes,
        visitorCount = 1
      } = appointmentData;

      // Validate slot availability
      const date = new Date(scheduledAt);
      const availableSlots = await this.getAvailableSlots(date, appointmentType, agentId);

      const requestedSlot = availableSlots.find(slot =>
        slot.start.getTime() === date.getTime()
      );

      if (!requestedSlot) {
        throw new Error('Requested time slot is not available');
      }

      const appointmentConfig = this.getAppointmentTypes().find(type => type.type === appointmentType);

      // Create appointment
      const result = await query(`
        INSERT INTO appointments (
          contact_id, agent_id, appointment_type, scheduled_at,
          duration_minutes, property_id, notes, visitor_count, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        contactId,
        agentId,
        appointmentType,
        scheduledAt,
        appointmentConfig.duration,
        propertyId,
        notes,
        visitorCount,
        'confirmed'
      ]);

      return {
        success: true,
        appointment: result.rows[0],
        appointmentId: result.rows[0].id
      };
    } catch (error) {
      console.error('Error booking appointment:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get appointment by ID
  async getAppointment(appointmentId) {
    try {
      const result = await query('SELECT * FROM appointments WHERE id = $1', [appointmentId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting appointment:', error);
      return null;
    }
  }

  // Update appointment
  async updateAppointment(appointmentId, updates) {
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      Object.keys(updates).forEach(key => {
        fields.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      });

      values.push(appointmentId);

      const result = await query(`
        UPDATE appointments
        SET ${fields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `, values);

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error updating appointment:', error);
      return null;
    }
  }

  // Cancel appointment
  async cancelAppointment(appointmentId, reason = null) {
    try {
      const result = await query(`
        UPDATE appointments
        SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = $2
        WHERE id = $1
        RETURNING *
      `, [appointmentId, reason]);

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      return null;
    }
  }

  // Get appointments for contact
  async getContactAppointments(contactId, status = null, limit = 10) {
    try {
      let queryText = 'SELECT * FROM appointments WHERE contact_id = $1';
      const params = [contactId];

      if (status) {
        queryText += ' AND status = $2';
        params.push(status);
      }

      queryText += ' ORDER BY scheduled_at DESC LIMIT $' + (params.length + 1);
      params.push(limit);

      const result = await query(queryText, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting contact appointments:', error);
      return [];
    }
  }

  // Get agent schedule for date
  async getAgentSchedule(agentId, date) {
    try {
      const dateStr = date.toISOString().split('T')[0];

      const result = await query(`
        SELECT * FROM appointments
        WHERE agent_id = $1 AND DATE(scheduled_at) = $2 AND status != 'cancelled'
        ORDER BY scheduled_at
      `, [agentId, dateStr]);

      return result.rows;
    } catch (error) {
      console.error('Error getting agent schedule:', error);
      return [];
    }
  }

  // Send reminders
  async sendReminders() {
    try {
      // Get appointments needing reminders (24h and 2h before)
      const result = await query(`
        SELECT a.*, c.whatsapp_number, c.first_name
        FROM appointments a
        JOIN contacts c ON a.contact_id = c.id
        WHERE a.status = 'confirmed'
        AND a.scheduled_at > NOW()
        AND (
          (a.scheduled_at - INTERVAL '24 hours' <= NOW() AND a.reminder_24h_sent = false) OR
          (a.scheduled_at - INTERVAL '2 hours' <= NOW() AND a.reminder_2h_sent = false)
        )
      `);

      const reminders = result.rows;
      const WhatsAppService = require('./whatsapp');

      for (const appointment of reminders) {
        const reminderType = appointment.scheduled_at - Date.now() <= 2 * 60 * 60 * 1000 ? '2h' : '24h';
        const message = this.generateReminderMessage(appointment, reminderType);

        await WhatsAppService.sendTextMessage(appointment.whatsapp_number, message);

        // Update reminder sent status
        await query(`
          UPDATE appointments
          SET ${reminderType === '24h' ? 'reminder_24h_sent' : 'reminder_2h_sent'} = true
          WHERE id = $1
        `, [appointment.id]);
      }

      return { success: true, remindersSent: reminders.length };
    } catch (error) {
      console.error('Error sending reminders:', error);
      return { success: false, error: error.message };
    }
  }

  // Generate reminder message
  generateReminderMessage(appointment, type) {
    const time = new Date(appointment.scheduled_at).toLocaleString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    if (type === '24h') {
      return `📅 *Appointment Reminder*

Hi ${appointment.first_name},

Your ${appointment.appointment_type.replace('_', ' ')} is scheduled for tomorrow:

🕐 ${time}
📍 ${appointment.location || 'To be shared'}

Please arrive 10 minutes early. If you need to reschedule, reply with "RESCHEDULE".

See you soon! 🏠`;
    } else {
      return `⏰ *Appointment Reminder*

Hi ${appointment.first_name},

Your ${appointment.appointment_type.replace('_', ' ')} is in 2 hours:

🕐 ${time}
📍 ${appointment.location || 'Location details will be shared soon'}

Don't forget to bring:
✓ Valid ID proof
✓ Address proof (if required)

Safe travels! 🚗`;
    }
  }

  // Route optimization for multiple appointments
  optimizeRoute(appointments) {
    // Simple nearest neighbor algorithm for route optimization
    if (appointments.length <= 1) return appointments;

    const optimized = [appointments[0]];
    const remaining = appointments.slice(1);

    while (remaining.length > 0) {
      const lastAppointment = optimized[optimized.length - 1];
      let nearestIndex = 0;
      let minDistance = this.calculateDistance(lastAppointment, remaining[0]);

      for (let i = 1; i < remaining.length; i++) {
        const distance = this.calculateDistance(lastAppointment, remaining[i]);
        if (distance < minDistance) {
          minDistance = distance;
          nearestIndex = i;
        }
      }

      optimized.push(remaining[nearestIndex]);
      remaining.splice(nearestIndex, 1);
    }

    return optimized;
  }

  // Calculate distance between appointments (simplified)
  calculateDistance(apt1, apt2) {
    // This would use actual coordinates in a real implementation
    // For now, return a random distance for demonstration
    return Math.random() * 10;
  }

  // Get appointment statistics
  async getAppointmentStats(agentId = null, dateRange = null) {
    try {
      let queryText = `
        SELECT
          COUNT(*) as total_appointments,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
          AVG(CASE WHEN status = 'completed' THEN duration_minutes END) as avg_duration
        FROM appointments
        WHERE 1=1
      `;
      const params = [];
      let paramCount = 1;

      if (agentId) {
        queryText += ` AND agent_id = $${paramCount}`;
        params.push(agentId);
        paramCount++;
      }

      if (dateRange) {
        queryText += ` AND scheduled_at >= $${paramCount} AND scheduled_at <= $${paramCount + 1}`;
        params.push(dateRange.start, dateRange.end);
      }

      const result = await query(queryText, params);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting appointment stats:', error);
      return null;
    }
  }
}

module.exports = new SchedulingService();