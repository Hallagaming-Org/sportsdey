import { CalendarDays } from "lucide-react";
import { useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MIN_AGE_YEARS = 18;
const MAX_AGE_YEARS = 120;

function startOfDay(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function maxSelectableDob(today = new Date()): Date {
	return new Date(
		today.getFullYear() - MIN_AGE_YEARS,
		today.getMonth(),
		today.getDate(),
	);
}

function minSelectableDob(today = new Date()): Date {
	return new Date(today.getFullYear() - MAX_AGE_YEARS, 0, 1);
}

export function parseDobToDate(value: string): Date | undefined {
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
	if (iso) {
		return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
	}
	const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);
	if (dmy) {
		return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
	}
	return undefined;
}

export function formatDobDisplay(date: Date): string {
	const day = String(date.getDate()).padStart(2, "0");
	const month = String(date.getMonth() + 1).padStart(2, "0");
	return `${day}/${month}/${date.getFullYear()}`;
}

type DobPickerProps = {
	id?: string;
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
	placeholder?: string;
	className?: string;
	triggerClassName?: string;
};

export function DobPicker({
	id,
	value,
	onChange,
	disabled = false,
	placeholder = "Select date of birth",
	className,
	triggerClassName,
}: DobPickerProps) {
	const [open, setOpen] = useState(false);
	const selected = useMemo(() => parseDobToDate(value), [value]);
	const minDate = useMemo(() => minSelectableDob(), []);
	const maxDate = useMemo(() => maxSelectableDob(), []);

	return (
		<div className={cn("min-w-0", className)}>
			<Popover
				open={disabled ? false : open}
				onOpenChange={(next) => {
					if (!disabled) setOpen(next);
				}}
			>
				<PopoverTrigger asChild>
					<button
						id={id}
						type="button"
						disabled={disabled}
						className={cn(
							"flex w-full items-center gap-3 text-left",
							disabled ? "cursor-default" : "cursor-pointer",
							triggerClassName,
						)}
						aria-label="Date of birth"
					>
						<CalendarDays className="h-4 w-4 shrink-0 opacity-60" />
						<span className={cn(!selected && "opacity-50")}>
							{selected ? formatDobDisplay(selected) : placeholder}
						</span>
					</button>
				</PopoverTrigger>
				<PopoverContent className="w-auto overflow-hidden p-0" align="start">
					<Calendar
						mode="single"
						captionLayout="dropdown"
						selected={selected}
						defaultMonth={selected ?? maxDate}
						startMonth={minDate}
						endMonth={maxDate}
						disabled={(date) => {
							const day = startOfDay(date);
							return day > maxDate || day < minDate;
						}}
						onSelect={(date) => {
							if (!date) return;
							onChange(formatDobDisplay(date));
							setOpen(false);
						}}
					/>
				</PopoverContent>
			</Popover>
		</div>
	);
}
