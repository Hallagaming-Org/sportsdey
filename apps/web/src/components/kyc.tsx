import React, { type ReactNode, useRef } from "react";
import {
	ChevronDown,
	Check,
	FileUp,
	FileIcon,
	LockKeyhole,
	ShieldCheck,
	UserRound,
	X,
} from "lucide-react";

export function KycShell({ children }: { children: ReactNode }) {
	return (
		<div className="my-5">
			<section className="space-y-4">{children}</section>
		</div>
	);
}

export function KycHeader({ compact = false }: { compact?: boolean }) {
	return (
		<div className="flex items-center justify-between rounded-2xl bg-white px-6 py-5 shadow-sm dark:bg-[#202120]">
			<div>
				<h1 className="font-semibold text-[28px] text-primary leading-tight dark:text-white">
					KYC Verification
				</h1>
				<p className="mt-2 text-[14px] text-primary dark:text-white">
					Verification of the profile!
				</p>
			</div>
			<div className="hidden h-[56px] w-[97px] items-center justify-center rounded-xl bg-[#F0F0F0] sm:flex dark:bg-[#2A2A2A]">
				{compact ? (
					<KycSecurityIllustration className="scale-[0.45]" />
				) : (
					<UserRound className="h-[34px] w-[34px] fill-primary text-primary dark:fill-[#6C7073] dark:text-[#6C7073]" />
				)}
			</div>
		</div>
	);
}

export function KycSecurityIllustration({ className = "" }: { className?: string }) {
	return (
		<div className={`relative h-32 w-40 ${className}`} aria-hidden="true">
			<div className="absolute right-8 bottom-2 h-20 w-24 -rotate-6 rounded-xl border border-[#7D7D7D] bg-gradient-to-br from-[#F3F3F3] via-[#BDBDBD] to-[#6E6E6E] shadow-lg">
				<div className="absolute top-8 left-10 h-5 w-3 rounded-full bg-[#202120]" />
				<div className="absolute -top-14 left-7 h-20 w-11 rounded-t-full border-[#8B8B8B] border-[9px] border-b-0 bg-transparent" />
			</div>
			<div className="absolute right-0 bottom-8 flex h-16 w-14 rotate-12 items-center justify-center rounded-[18px] border-4 border-white bg-[#DCEBFF] text-[#5876FF] shadow-md">
				<ShieldCheck className="h-10 w-10" />
			</div>
			<div className="absolute bottom-10 left-2 rounded-full bg-[#A8E63E] px-3 py-1 font-bold text-white text-xl shadow">
				***
			</div>
		</div>
	);
}

export function KycInputField({
	id,
	label,
	placeholder,
	value,
	onChange,
	type = "text",
}: {
	id: string;
	label: string;
	placeholder: string;
	value?: string;
	onChange?: (value: string) => void;
	type?: string;
}) {
	return (
		<div>
			<label
				htmlFor={id}
				className="mb-3 block font-medium text-primary text-sm dark:text-white"
			>
				{label}
			</label>
			<input
				id={id}
				type={type}
				value={value}
				onChange={(e) => onChange?.(e.target.value)}
				placeholder={placeholder}
				className="w-full rounded-lg border border-[#E5E7EB] bg-[#F7F7F7] px-4 py-4 text-sm text-primary shadow-sm placeholder:text-[#6B7280] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-700 dark:bg-[#2A2A2A] dark:text-white dark:placeholder:text-white/50 dark:focus:border-primary"
			/>
		</div>
	);
}

export function KycSelectField({
	id,
	label,
	placeholder,
	value,
	onChange,
	options,
}: {
	id: string;
	label: string;
	placeholder: string;
	value?: string;
	onChange?: (value: string) => void;
	options?: { value: string; label: string }[];
}) {
	const [isOpen, setIsOpen] = React.useState(false);

	const handleSelect = (optionValue: string) => {
		onChange?.(optionValue);
		setIsOpen(false);
	};

	return (
		<div className="relative">
			<label
				htmlFor={id}
				className="mb-3 block font-medium text-primary text-sm dark:text-white"
			>
				{label}
			</label>
			<button
				id={id}
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="flex w-full items-center justify-between rounded-lg bg-[#F7F7F7] px-4 py-4 text-left text-sm shadow-sm dark:bg-[#2A2A2A] dark:text-white"
			>
				<span className={value ? "text-primary dark:text-white" : "text-[#6B7280]"}>
					{value
						? options?.find((o) => o.value === value)?.label ?? value
						: placeholder}
				</span>
				<ChevronDown className="h-5 w-5 text-[#6B7280] dark:text-white/70" />
			</button>
			{isOpen && options && (
				<div className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-lg dark:bg-[#2A2A2A]">
					{options.map((option) => (
						<button
							key={option.value}
							type="button"
							onClick={() => handleSelect(option.value)}
							className="w-full px-4 py-3 text-left text-sm hover:bg-gray-100 dark:text-white dark:hover:bg-gray-800"
						>
							{option.label}
						</button>
					))}
				</div>
			)}
		</div>
	);
}

export function KycUploadBox({
	label,
	value,
	onChange,
}: {
	label: string;
	value?: File | string | null;
	onChange?: (file: File | null) => void;
}) {
	const inputRef = useRef<HTMLInputElement>(null);

	const handleClick = () => {
		inputRef.current?.click();
	};

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0] ?? null;
		onChange?.(file);
	};

	const handleRemove = (e: React.MouseEvent) => {
		e.stopPropagation();
		onChange?.(null);
		if (inputRef.current) {
			inputRef.current.value = "";
		}
	};

	const fileUrl = typeof value === "string" ? value : null;
	const fileName = value instanceof File ? value.name : null;

	return (
		<div>
			<p className="mb-3 font-medium text-primary text-sm dark:text-white">
				{label}
			</p>
			<input
				ref={inputRef}
				type="file"
				accept="image/jpeg,image/png,application/pdf"
				onChange={handleFileChange}
				className="hidden"
			/>
			{fileUrl || fileName ? (
				<div className="relative flex min-h-[140px] w-full items-center justify-center rounded-xl bg-[#F7F7F7] p-4 dark:bg-[#2A2A2A]">
					{fileUrl ? (
						<div className="flex flex-col items-center">
							{fileUrl.endsWith(".pdf") ? (
								<FileIcon className="h-12 w-12 text-[#8C8C8C]" />
							) : (
								<img
									src={fileUrl}
									alt={`${label} preview`}
									className="max-h-32 rounded-lg object-contain"
								/>
							)}
							<span className="mt-2 text-xs text-[#8C8C8C]">Uploaded</span>
						</div>
					) : (
						<span className="text-sm text-[#8C8C8C]">{fileName}</span>
					)}
					<button
						type="button"
						onClick={handleRemove}
						className="absolute right-2 top-2 rounded-full bg-gray-200 p-1 hover:bg-gray-300 dark:bg-gray-700"
					>
						<X className="h-4 w-4" />
					</button>
				</div>
			) : (
				<button
					type="button"
					onClick={handleClick}
					className="flex min-h-[140px] w-full items-center justify-center rounded-xl bg-[#F7F7F7] p-8 dark:bg-[#2A2A2A]"
				>
					<span className="flex w-full max-w-[340px] flex-col items-center justify-center rounded-xl border border-[#BDBDBD] border-dashed px-6 py-5 text-center">
						<FileUp className="mb-3 h-5 w-5 text-[#8C8C8C]" />
						<span className="text-[#8C8C8C] text-sm">Choose an Image/Video</span>
						<span className="mt-1 text-[#B0B0B0] text-xs">
							Upload supports: JPG, PDF, PNG.
						</span>
					</span>
				</button>
			)}
		</div>
	);
}

export const KycCheckIcon = Check;
export const KycLockIcon = LockKeyhole;
