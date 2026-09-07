import React, { useMemo } from "react";
import { Inbox } from "lucide-react";
import { pendingForDepartment } from "@shared/departmentQueueRules";
import type { DepartmentCode } from "@shared/departmentAccess";
import { StatusBadge } from "./primitives";
import type { Booking } from "./shared";

/**
 * Pending Actions widget (PRD v3.0 §8 shared pattern): the bookings whose
 * next action belongs to one department, oldest mobilization first, with
 * text urgency badges (never color alone).
 */
export function PendingActionsQueue({
  bookings,
  departmentCode,
  departmentName,
  onOpenDossier,
}: {
  bookings: Booking[];
  departmentCode: DepartmentCode;
  departmentName: string;
  onOpenDossier: (booking: Booking) => void;
}) {
  const items = useMemo(
    () => pendingForDepartment(bookings, departmentCode),
    [bookings, departmentCode]
  );

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-header">
        <div>
          <div className="panel-title">
            <Inbox size={15} /> Pending actions · {departmentName}
          </div>
          <div className="panel-meta">
            {items.length === 0
              ? "Nothing waiting on this department."
              : `${items.length} dossier${items.length === 1 ? "" : "s"} need this department's input, oldest first.`}
          </div>
        </div>
      </div>
      {items.length > 0 && (
        <div className="detail-list">
          {items.map(item => (
            <div className="detail-cell" key={item.id}>
              <label>
                {item.client} · {item.stage}
              </label>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => onOpenDossier(item)}
                >
                  {item.id} · {item.project}
                </button>
                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <StatusBadge value={item.priority} />
                  <StatusBadge
                    value={
                      item.daysToMob === null
                        ? "Mob date TBD"
                        : item.urgency === "overdue"
                          ? `Overdue · mob ${item.mob}`
                          : item.urgency === "due-soon"
                            ? `Due soon · ${item.daysToMob}d`
                            : `Mob ${item.mob}`
                    }
                  />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
