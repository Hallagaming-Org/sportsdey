import { AlertCircle, RefreshCw } from "lucide-react";
import React, { Component, type ReactNode } from "react";

interface Props {
	children: ReactNode;
	fallback?: ReactNode;
}

interface State {
	hasError: boolean;
	error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
	}

	handleRefresh = () => {
		window.location.reload();
	};

	render() {
		if (this.state.hasError) {
			if (this.props.fallback) {
				return this.props.fallback;
			}

			return (
				<div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
					<div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
						<div className="mb-4 flex items-center justify-center">
							<div className="rounded-full bg-red-100 p-3">
								<AlertCircle className="h-8 w-8 text-red-600" />
							</div>
						</div>

						<h1 className="mb-2 text-center font-bold text-2xl text-gray-900">
							Something went wrong
						</h1>

						<p className="mb-6 text-center text-gray-600">
							We encountered an unexpected error. Please try refreshing the
							page.
						</p>

						{/* {this.state.error && (
                            <div className="mb-6 rounded-md bg-gray-100 p-4">
                                <p className="text-sm text-gray-700">
                                    <strong>Error:</strong> {this.state.error.message}
                                </p>
                            </div>
                        )} */}

						<button
							onClick={this.handleRefresh}
							className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1BAA04] px-4 py-3 font-medium text-white transition-colors hover:bg-[#158f03]"
						>
							<RefreshCw className="h-5 w-5" />
							Refresh Page
						</button>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}
