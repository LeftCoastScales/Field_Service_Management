"use client"

import { Button } from "../components/ui/button"
import { cn } from "../lib/utils"
import { format, addDays, isSameDay, startOfWeek } from "date-fns"
import { useState, useEffect } from "react"

interface DateSelectorProps {
  selectedDate: Date
  onDateSelect: (date: Date) => void
}

export function DateSelector({ selectedDate, onDateSelect }: DateSelectorProps) {
  const [visibleDates, setVisibleDates] = useState<Date[]>([])

  useEffect(() => {
    const calculateVisibleDates = () => {
      const containerWidth = window.innerWidth - 64 // Subtracting sidebar width
      const dateButtonWidth = 80 // Estimated width of each date button
      const visibleCount = Math.floor(containerWidth / dateButtonWidth)

      const startDate = startOfWeek(selectedDate, { weekStartsOn: 1 })
      const dates = []
      const halfCount = Math.floor(visibleCount / 2)

      for (let i = -halfCount; i <= halfCount; i++) {
        dates.push(addDays(startDate, i))
      }
      setVisibleDates(dates)
    }

    calculateVisibleDates()
    window.addEventListener("resize", calculateVisibleDates)
    return () => window.removeEventListener("resize", calculateVisibleDates)
  }, [selectedDate])

  return (
    <div className="border-b">
      <div className="flex justify-center">
        {visibleDates.map((date) => (
          <Button
            key={date.toISOString()}
            variant="ghost"
            className={cn(
              "flex h-14 w-[80px] flex-col items-center justify-center rounded-none border-b-2 border-transparent px-1 py-1",
              isSameDay(date, selectedDate) && "border-primary bg-primary/10",
            )}
            onClick={() => onDateSelect(date)}
          >
            <span className="text-[10px] font-normal text-muted-foreground">{format(date, "EEE").toUpperCase()}</span>
            <span className="text-sm font-medium">{format(date, "d MMM")}</span>
          </Button>
        ))}
      </div>
    </div>
  )
}

