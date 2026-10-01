import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function db() {
  return createAdminClient();
}

function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function cleanError(error: unknown) {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  if (typeof error === "object" && error && "message" in error) return String((error as { message?: unknown }).message || "Request failed");
  return "Request failed";
}

export async function GET() {
  try {
    const supabase = db();

    const [
      roomsRes,
      reservationsRes,
      expensesRes,
      housekeepingRes,
      maintenanceRes,
      staffRes,
      handoverRes,
      auditsRes,
      settingsRes,
    ] = await Promise.all([
      supabase.from("lsh_rooms").select("*").order("floor").order("room_number"),
      supabase.from("lsh_reservations").select("*, guest:lsh_guests(*), room:lsh_rooms(*)").order("created_at", { ascending: false }),
      supabase.from("lsh_expenses").select("*").eq("voided", false).order("expense_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("lsh_housekeeping_tasks").select("*, room:lsh_rooms(*)").neq("status", "Done").order("created_at"),
      supabase.from("lsh_maintenance_tickets").select("*, room:lsh_rooms(*)").in("status", ["Open", "In Progress"]).order("created_at", { ascending: false }),
      supabase.from("lsh_staff").select("*").order("role").order("full_name"),
      supabase.from("lsh_shift_handover").select("*").order("created_at", { ascending: false }).limit(10),
      supabase.from("lsh_night_audits").select("*").order("business_date", { ascending: false }).limit(30),
      supabase.from("lsh_settings").select("*"),
    ]);

    for (const result of [roomsRes, reservationsRes, expensesRes, housekeepingRes, maintenanceRes, staffRes, handoverRes, auditsRes, settingsRes]) {
      if (result.error) throw result.error;
    }

    const reservations = reservationsRes.data || [];
    const reservationIds = reservations.map((r) => r.id);
    const [chargesRes, paymentsRes] = reservationIds.length
      ? await Promise.all([
          supabase.from("lsh_folio_charges").select("*").in("reservation_id", reservationIds).eq("voided", false),
          supabase.from("lsh_payments").select("*").in("reservation_id", reservationIds).eq("status", "Posted"),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];

    if (chargesRes.error) throw chargesRes.error;
    if (paymentsRes.error) throw paymentsRes.error;

    const charges = chargesRes.data || [];
    const payments = paymentsRes.data || [];

    const bookings = reservations.map((r) => {
      const resCharges = charges.filter((c) => c.reservation_id === r.id);
      const resPayments = payments.filter((p) => p.reservation_id === r.id);
      const gross = resCharges.reduce((sum, c) => {
        const base = Math.max(Number(c.quantity) * Number(c.unit_price) - Number(c.discount_amount || 0), 0);
        return sum + base * (1 + Number(c.tax_rate || 0) / 100);
      }, 0);
      const paid = resPayments.reduce((sum, p) => sum + (p.kind === "Refund" ? -Number(p.amount) : Number(p.amount)), 0);
      return {
        id: r.booking_no,
        reservationId: r.id,
        guest: r.guest?.full_name || "Guest",
        phone: r.guest?.phone || "",
        guestId: r.guest_id,
        room: r.room?.room_number || "",
        roomId: r.room_id,
        checkIn: r.check_in_date,
        checkOut: r.check_out_date,
        source: r.source,
        status: r.status,
        amount: Math.round(gross * 100) / 100,
        paid: Math.round(paid * 100) / 100,
        receivable: r.is_receivable,
      };
    });

    const rooms = (roomsRes.data || []).map((r) => {
      const active = reservations.find((b) => b.room_id === r.id && b.status === "Checked-in");
      const guest = active ? (active.guest?.full_name || undefined) : undefined;
      return {
        id: r.id,
        number: r.room_number,
        floor: r.floor,
        type: r.room_type,
        rate: Number(r.base_rate),
        status: r.status,
        guest,
      };
    });

    const expenses = (expensesRes.data || []).map((e) => ({
      id: e.expense_no,
      dbId: e.id,
      date: e.expense_date,
      category: e.category,
      vendor: e.vendor,
      amount: Number(e.amount),
      mode: e.payment_mode,
      note: e.note || "",
    }));

    const tasks = (housekeepingRes.data || []).map((t) => ({
      id: t.id,
      room: t.room?.room_number || "",
      priority: t.priority,
      assignee: t.assignee || "Unassigned",
      status: t.status,
    }));

    const maintenance = (maintenanceRes.data || []).map((m) => ({
      id: m.id,
      room: m.room?.room_number || "",
      category: m.category,
      priority: m.priority,
      description: m.description,
      assignee: m.assignee || "Unassigned",
      status: m.status,
      blocksRoom: m.blocks_room,
    }));

    return NextResponse.json({
      ok: true,
      rooms,
      bookings,
      expenses,
      tasks,
      maintenance,
      staff: staffRes.data || [],
      handovers: handoverRes.data || [],
      audits: auditsRes.data || [],
      settings: settingsRes.data || [],
    });
  } catch (error) {
    console.error("PMS GET failed", error);
    return fail(cleanError(error), 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body.action || "");
    const supabase = db();

    let result: { data: unknown; error: unknown } | null = null;

    switch (action) {
      case "createReservation":
        result = await supabase.rpc("lsh_create_reservation", {
          p_guest_name: body.guest,
          p_phone: body.phone,
          p_room_number: body.room,
          p_check_in: body.checkIn,
          p_check_out: body.checkOut,
          p_source: body.source || "Direct",
          p_nightly_rate: Number(body.nightlyRate || 0) || null,
          p_advance: Number(body.advance || 0),
          p_actor: body.actor || "Front Desk",
        });
        break;
      case "checkIn":
        result = await supabase.rpc("lsh_check_in", {
          p_booking_no: body.bookingNo,
          p_actor: body.actor || "Front Desk",
        });
        break;
      case "checkOut":
        result = await supabase.rpc("lsh_check_out", {
          p_booking_no: body.bookingNo,
          p_mark_receivable: Boolean(body.markReceivable),
          p_actor: body.actor || "Front Desk",
        });
        break;
      case "addPayment":
        result = await supabase.rpc("lsh_add_payment", {
          p_booking_no: body.bookingNo,
          p_amount: Number(body.amount),
          p_method: body.method,
          p_reference: body.reference || null,
          p_actor: body.actor || "Front Desk",
        });
        break;
      case "addCharge":
        result = await supabase.rpc("lsh_add_charge", {
          p_booking_no: body.bookingNo,
          p_category: body.category || "Miscellaneous",
          p_description: body.description,
          p_quantity: Number(body.quantity || 1),
          p_unit_price: Number(body.unitPrice || 0),
          p_tax_rate: Number(body.taxRate || 0),
          p_discount: Number(body.discount || 0),
          p_actor: body.actor || "Front Desk",
        });
        break;
      case "setRoomStatus":
        result = await supabase.rpc("lsh_set_room_status", {
          p_room_number: body.room,
          p_status: body.status,
          p_actor: body.actor || "Front Desk",
        });
        break;
      case "advanceHousekeeping":
        result = await supabase.rpc("lsh_advance_housekeeping", {
          p_task_id: body.taskId,
          p_actor: body.actor || "Housekeeping",
        });
        break;
      case "createMaintenance":
        result = await supabase.rpc("lsh_create_maintenance", {
          p_room_number: body.room,
          p_category: body.category || "General",
          p_priority: body.priority || "Normal",
          p_description: body.description,
          p_blocks_room: body.blocksRoom !== false,
          p_actor: body.actor || "Front Desk",
        });
        break;
      case "resolveMaintenance":
        result = await supabase.rpc("lsh_resolve_maintenance", {
          p_ticket_id: body.ticketId,
          p_actor: body.actor || "Maintenance",
        });
        break;
      case "recordExpense":
        result = await supabase.rpc("lsh_record_expense", {
          p_date: body.date,
          p_category: body.category,
          p_vendor: body.vendor,
          p_amount: Number(body.amount),
          p_mode: body.mode,
          p_note: body.note || null,
          p_actor: body.actor || "Front Desk",
        });
        break;
      case "closeNightAudit":
        result = await supabase.rpc("lsh_close_night_audit", {
          p_business_date: body.businessDate,
          p_actor: body.actor || "Manager",
        });
        break;
      case "saveHandover": {
        const insert = await supabase.from("lsh_shift_handover").insert({
          shift_name: body.shiftName || "General",
          author_name: body.author || "Front Desk",
          note: body.note,
        }).select().single();
        result = insert;
        break;
      }
      default:
        return fail("Unknown PMS action");
    }

    if (!result) return fail("No action result");
    if (result.error) return fail(cleanError(result.error));

    return NextResponse.json({ ok: true, result: result.data });
  } catch (error) {
    console.error("PMS POST failed", error);
    return fail(cleanError(error), 500);
  }
}
