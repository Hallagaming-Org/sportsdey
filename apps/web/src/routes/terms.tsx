import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
	component: TermsPage,
});

const sections = [
	{ id: "introduction", title: "INTRODUCTION AND CONTRACTING PARTIES" },
	{ id: "availability", title: "AVAILABILITY OF THE WEBSITE AND SERVICES" },
	{ id: "amendments", title: "AMENDMENTS TO THE TERMS OF USE" },
	{ id: "registration", title: "REGISTRATION AND ACCOUNT MANAGEMENT" },
	{ id: "deposits", title: "DEPOSITS AND WITHDRAWALS" },
	{ id: "placing-bets", title: "PLACING BETS" },
	{ id: "bonuses", title: "BONUSES / PROMOTIONS & REWARDS" },
	{ id: "responsible-gaming", title: "RESPONSIBLE GAMING" },
	{ id: "errors", title: "ERRORS AND OMISSIONS" },
	{ id: "no-warranty", title: "NO WARRANTY" },
	{ id: "limitations", title: "LIMITATIONS OF LIABILITY" },
	{ id: "intellectual-property", title: "INTELLECTUAL PROPERTY RIGHTS" },
	{ id: "complaints", title: "COMPLAINTS AND CLAIMS" },
	{ id: "waiver", title: "WAIVER" },
	{ id: "severability", title: "SEVERABILITY" },
	{ id: "assignment", title: "ASSIGNMENT AND TRANSFER" },
	{ id: "relationship", title: "RELATIONSHIP AND THIRD PARTY RIGHTS" },
	{ id: "applicable-law", title: "APPLICABLE LAW AND PLACE OF JURISDICTION" },
	{ id: "entire-agreement", title: "ENTIRE AGREEMENT" },
];

const toc = sections.map((s, i) => ({ ...s, number: i + 1 }));

function TermsPage() {
	const scrollToTop = () => {
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	return (
		<div className="min-h-screen bg-[#000606] text-white">
			<div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
				<div className="mb-8">
					<Link
						to="/"
						className="mb-6 inline-flex items-center gap-2 text-sm text-[#A0A0A0] transition-colors hover:text-white"
					>
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
						</svg>
						Back to Home
					</Link>
					<h1 className="text-3xl font-bold text-white sm:text-4xl">
						General Terms & Conditions
					</h1>
					<p className="mt-2 text-sm text-[#A0A0A0]">
						Version 0: Effective June 2026
					</p>
				</div>

				<div className="mb-10 rounded-lg border border-[#1B2722] bg-[#0A1110] p-6">
					<h2 className="mb-4 text-lg font-semibold text-white">Contents</h2>
					<nav className="space-y-1.5">
						{toc.map((item) => (
							<a
								key={item.id}
								href={`#${item.id}`}
								className="flex items-start gap-2 text-sm text-[#A0A0A0] transition-colors hover:text-white"
							>
								<span className="shrink-0 font-medium text-[#18b100]">{item.number}.</span>
								<span>{item.title}</span>
							</a>
						))}
					</nav>
				</div>

				<div className="space-y-10">
					<section id="introduction">
						<h2 className="mb-4 text-xl font-bold text-white">
							1. INTRODUCTION AND CONTRACTING PARTIES
						</h2>
						<div className="space-y-4 text-sm leading-relaxed text-[#C8C8C8]">
							<p>
								1. These Terms and Conditions shall apply to all aspects of the use of the website
								Sportsdey.com and any of its subdomains and mobile application (the "Website"), the
								online betting account via the Website (the "Account") and the gaming and gambling
								products and betting services operated via the Website (the "Services"). The Website
								belongs to Halla Gaming Limited. Owner of the Brand "Sportsdey" (or "we" or "us" and
								variations of the same), which is registered at First Floor, Lagos City Mall, Onikan,
								Lagos, Nigeria, acting under the National Sports Betting Permit No. 00000010, issued
								by the National Lottery Regulatory Commission on the 15th August 2023, and having all
								rights to operate the gaming software.
							</p>
							<p>
								2. Please read these General Terms and Conditions carefully before you start to use any
								section of the Website. By using any section of the Website and/or by registering the
								Account, you agree to be bound by these Terms & Conditions together with:
							</p>
							<ol className="list-inside list-decimal space-y-1 pl-4">
								<li>Sports Terms and Conditions;</li>
								<li>Live Betting Terms and Conditions;</li>
								<li>Virtual Terms and Conditions;</li>
								<li>Casino Terms and Conditions;</li>
								<li>Privacy Policy;</li>
							</ol>
							<p>
								3. and any terms and conditions and/or rules about promotions, bonuses and special offers
								which may be made available from time to time (together, the "Terms of Use").
							</p>
							<p>
								4. "User", "you" and "your" refers to you, the private person accessing any part of the
								Website, registering an Account and/or using any of the Services. Your continued use of
								the Website and/or the Services, as the case may be, shall constitute the acceptance of
								the Terms of Use.
							</p>
						</div>
					</section>

					<section id="availability">
						<h2 className="mb-4 text-xl font-bold text-white">
							2. AVAILABILITY OF THE WEBSITE AND SERVICES
						</h2>
						<div className="space-y-4 text-sm leading-relaxed text-[#C8C8C8]">
							<p>
								1. Sportsdey does not guarantee uninterrupted access to the Website or the continuous
								functionality of its Services. We reserve the right to modify, suspend, or withdraw any
								aspect or feature of the Website or Services without prior notice. Furthermore, Sportsdey
								retains the discretion to alter the content of the Website and Services (including any
								betting products or features) at any time.
							</p>
							<p>
								2. Personal Use - You are permitted to use the Website and Services for personal,
								non-commercial purposes only. You may not reproduce, duplicate, or link to the Website
								in a way that implies endorsement, sponsorship, or approval by Sportsdey without express
								written permission. Unauthorized use is strictly prohibited.
							</p>
							<p>
								3. Third-Party Links - The Website may contain links to third-party websites or
								resources. These links are provided solely for your convenience, and Sportsdey has no
								control over the content of such websites. We accept no responsibility for any loss or
								damage arising from your use of third-party sites, their content, or the information
								they collect (including personal data). The presence of such a link does not constitute
								an endorsement by Sportsdey of the site, its content, or the services it offers.
							</p>
							<p>
								4. Lawful Use - You agree to use the Website and Services for lawful purposes only and
								to comply with all relevant laws, statutes, and regulations. Any misuse, such as
								introducing harmful software (viruses, trojans, worms, etc.) or attempting unauthorized
								access to the Website or Services, is strictly prohibited. The information and data
								available on the Website (such as results, odds, and statistics) are for personal use
								only, and any distribution or commercial use is forbidden. Automated systems or software
								designed to copy or extract such data are not allowed.
							</p>
							<p>
								5. User Responsibility and Software Compatibility - You are solely responsible for
								ensuring that you have the necessary arrangements to access the Website, your account,
								and the Services. Sportsdey does not guarantee compatibility with your hardware or
								software. Some Services may require you to download software, and any such software
								provided by us is licensed to you solely to access the Services. Downloads may place
								files on your device's hard drive, and you assume all risks associated with downloading
								material from the Website. Sportsdey accepts no liability for any issues arising from
								disconnection or unavailability of the Website, Services, or your account due to factors
								beyond our control (including your equipment, internet connection, or service provider).
							</p>
							<p>
								6. Any software made available through the Website is intended solely for use with
								Sportsdey products. The software remains the exclusive property of Sportsdey or its
								licensors and is protected by intellectual property laws. Using the software does not
								transfer any ownership rights to you.
							</p>
							<p>
								7. Time Zones - All dates and times displayed on the Website are in West Africa Time
								(WAT).
							</p>
							<p>
								8. Jurisdiction and Legal Compliance - Access to and use of the Website and Services may
								be illegal in certain countries, including the USA. It is your responsibility to ensure
								that your use of the Website and Services complies with the laws of your jurisdiction.
								The availability of the Website and Services does not constitute an offer or solicitation
								to engage in betting or gambling where such activities are illegal. Sportsdey is not
								liable for any legal violations committed by users accessing the Website from
								jurisdictions where betting is prohibited.
							</p>
							<p>
								9. Foreign Use - If you use the Services from outside Nigeria, your activity will be
								subject to relevant exchange control regulations and laws of the jurisdiction from which
								you are accessing the Website. It is your responsibility to comply with these
								regulations, and Sportsdey accepts no liability if we are unable to remit funds to
								accounts in foreign jurisdictions.
							</p>
							<p>
								10. Currency - All transactions and Services are offered exclusively in Nigerian Naira
								(NGN).
							</p>
						</div>
					</section>

					<section id="amendments">
						<h2 className="mb-4 text-xl font-bold text-white">
							3. AMENDMENTS TO THE TERMS OF USE
						</h2>
						<div className="space-y-4 text-sm leading-relaxed text-[#C8C8C8]">
							<p>
								1. Sportsdey reserves the right to modify any part of these Terms of Use at any time,
								for reasons including, but not limited to, ensuring compliance with relevant laws and
								regulations. Any updated version of the Terms of Use will be posted on the Website,
								along with the date it becomes effective. We encourage you to regularly review the Terms
								of Use to stay informed of any changes. It is your responsibility to ensure that you
								understand and agree to the Terms. If you find any changes unacceptable, you must
								discontinue use of the Website and your Account. By continuing to use the Website, your
								Account, or any of our Services after changes are made, you are acknowledging your
								acceptance of those changes.
							</p>
						</div>
					</section>

					<section id="registration">
						<h2 className="mb-4 text-xl font-bold text-white">
							4. REGISTRATION AND ACCOUNT MANAGEMENT
						</h2>
						<div className="space-y-4 text-sm leading-relaxed text-[#C8C8C8]">
							<div>
								<p className="mb-2 font-semibold text-white">1. Account Registration Requirement</p>
								<div className="space-y-2 pl-4">
									<p>
										1. To access and use any of the Services provided by Sportsdey, you must first
										register an Account.
									</p>
									<p>
										2. Sportsdey reserves the right to accept or reject your registration at its
										sole discretion, with or without providing any reason.
									</p>
								</div>
							</div>
							<div>
								<p className="mb-2 font-semibold text-white">2. Eligibility and Information Accuracy</p>
								<div className="space-y-2 pl-4">
									<p>1. By registering an Account, you confirm and agree to the following:</p>
									<p>
										2. You are at least 18 years old or of legal age as required by the jurisdiction
										in which you reside.
									</p>
									<p>
										3. You will provide accurate and complete information during registration,
										including but not limited to your full legal name, correct date of birth, country
										of residence, email address, and telephone number. You also agree to notify us
										of any changes to this information.
									</p>
									<p>
										4. You are opening the Account solely for personal use, acting on your own
										behalf, and not for any third party.
									</p>
									<p>
										5. You are legally capable of entering into binding agreements, including these
										Terms of Use and any subsequent bets or gameplay.
									</p>
								</div>
							</div>
							<div>
								<p className="mb-2 font-semibold text-white">
									3. Sportsdey reserves the right to verify your age and identity at any time. If it
									is discovered that you have breached this clause or provided false or misleading
									information:
								</p>
								<ol className="list-inside list-decimal space-y-1 pl-4">
									<li>Any bets placed by you may be cancelled.</li>
									<li>Any winnings associated with those bets may be forfeited.</li>
									<li>Your Account may be terminated.</li>
									<li>
										Sportsdey may report the matter to law enforcement, notify your family, or
										inform the relevant regulatory authority.
									</li>
								</ol>
							</div>
							<div>
								<p className="mb-2 font-semibold text-white">4. Verification and Compliance</p>
								<div className="space-y-2 pl-4">
									<p>
										1. By registering an Account or using any of Sportsdey's Services, you agree
										that we are entitled to conduct any identification, credit, or other verification
										checks, as required by law or deemed necessary by Sportsdey. You also agree to
										provide all requested information for these checks.
									</p>
									<p>
										2. Sportsdey reserves the right to suspend, limit, or restrict your Account or
										access to Services until all verification checks are completed to our
										satisfaction. If we are unable to verify your registration details, or if the
										information you provide is found to be false or inaccurate:
									</p>
									<ol className="list-inside list-decimal space-y-1 pl-4">
										<li>Any bets placed may be voided.</li>
										<li>Your Account may be suspended or terminated.</li>
										<li>Any remaining balance in your Account may be forfeited.</li>
									</ol>
									<p>
										3. Sportsdey may engage third parties to perform these verification checks. All
										personal data provided for registration or verification purposes will be handled
										following our Privacy Policy. It is your responsibility to ensure that all
										information provided remains current and accurate for ongoing verification
										checks.
									</p>
									<p>
										4. You are not permitted to buy, sell, or transfer your Account to any other
										individual. You must not transfer ownership or control of your Account, nor
										attempt to acquire or use another person's registered Account with Sportsdey.
									</p>
									<p>
										5. Employees of Sportsdey, individuals related to them, or anyone connected with
										third-party service providers or agents (as determined at Sportsdey's sole
										discretion) are prohibited from placing bets on any market or event. Any such
										bets will be considered void.
									</p>
									<p>
										6. Each user is permitted to open only one Account. If we have reasonable
										grounds to believe that you hold more than one Account (including Accounts
										created using misspelled names, email variations, or other methods), and we
										suspect a breach of the Terms of Use, we may close all duplicate Accounts or
										allow you to retain the first Account you registered with us. Any bets placed
										through duplicate Accounts may be declared void, and any associated winnings
										will be withheld.
									</p>
									<p>
										7. When creating an Account, you will be assigned or prompted to choose a
										username, and you must create a password. It is your responsibility to keep this
										information secure at all times. You are accountable for all activities and
										transactions performed through your Account. If you lose or forget your username
										or password, you should immediately update your credentials through your
										Account, the website, or by contacting customer support. If you suspect that a
										third party may have gained access to your Account information, including your
										email or mobile number, notify us immediately. Sportsdey assumes that all bets
										placed under your username and password are authorised by you, and will not be
										liable for any losses resulting from unauthorised use, including fraudulent
										activity or misuse of your credentials.
									</p>
								</div>
							</div>
							<div>
								<p className="mb-2 font-semibold text-white">5. Account Termination by User</p>
								<div className="space-y-2 pl-4">
									<p>
										1. You may request the termination of your Account at any time by submitting a
										written request to Customer Service via email or by managing your preferences
										through your Account settings. If your Account has a negative balance, the full
										amount must be paid to SPORTSDEY before the Account can be terminated. Upon
										termination, reactivation of the Account may be possible based on the
										circumstances and reason for the termination.
									</p>
									<p>
										2. Reactivation is subject to SPORTSDEY's discretion and successful identity
										verification. Should your Account be reactivated, your continued use of the
										Website and Services will be governed by the current Terms of Use in effect at
										the time of reactivation.
									</p>
									<p>
										3. Please note that once your Account has been closed, you will not be permitted
										to register a new one.
									</p>
								</div>
							</div>
							<div>
								<p className="mb-2 font-semibold text-white">
									6. Suspension or Termination by SPORTSDEY
								</p>
								<div className="space-y-2 pl-4">
									<p>
										1. If SPORTSDEY, at its sole discretion, determines that you have violated these
										Terms of Use, including sports or game-specific rules, bonus or promotion terms,
										or if you are suspected of collusion, fraud, or any other prohibited activity
										aimed at defrauding SPORTSDEY, or if there is unusual activity on your Account,
										SPORTSDEY reserves the right to:
									</p>
									<ol className="list-inside list-decimal space-y-1 pl-4">
										<li>Suspend your Account for up to 90 days;</li>
										<li>Restrict withdrawals, deposits, or betting on your Account;</li>
										<li>Deny you access to your Account; and/or</li>
										<li>Permanently terminate your Account.</li>
									</ol>
									<p>
										2. SPORTSDEY may require additional documentation to conduct an investigation or
										verify your compliance with these Terms (including identification documents or
										payment provider verification). In the case of an Account suspension, you will
										be notified via the email address or SMS, using the Mobile number linked to your
										Account or through a pop-up message upon login. However, providing such notice
										is not a precondition for suspension or termination.
									</p>
									<p>
										3. SPORTSDEY will attempt to address the cause of the suspension promptly,
										including requesting any necessary verification from you. Depending on the
										outcome of the investigation, your Account may either be reactivated or
										permanently terminated. If suspicious activity is detected, you may be required
										to provide additional proof of identity, source of funds, or address. This may
										include requests related to the size, volume, or patterns of your bets. Failure
										to provide this documentation may result in the immediate suspension or closure
										of your Account.
									</p>
									<p>
										4. If your Account is terminated due to a breach of these Terms or fraudulent
										activity, any open bets on upcoming events may be voided, and your original
										stakes returned. Multiple bets will be recalculated and settled accordingly. Any
										remaining balance, including winnings, may be forfeited in the event of
										fraudulent behaviour, and open bets may be void. Once your Account is terminated,
										your access to the Services will end immediately. It is your responsibility to
										uninstall or remove any related software or tools.
									</p>
								</div>
							</div>
							<div>
								<p className="mb-2 font-semibold text-white">7. Account Suspension and Termination</p>
								<div className="space-y-2 pl-4">
									<p>
										1. At SPORTSDEY, we reserve the right, at our absolute discretion and without
										the obligation to disclose any reason, to exclude any User from our Services,
										suspend or terminate any Account, and/or cancel any bets placed under the
										Account, including winning bets. This is without limitation to the rights and
										remedies available to SPORTSDEY under these Terms and Conditions or applicable
										law.
									</p>
								</div>
							</div>
							<div>
								<p className="mb-2 font-semibold text-white">
									8. Suspension or Termination by SPORTSDEY
								</p>
								<div className="space-y-2 pl-4">
									<p>
										1. If you have any concerns or queries regarding your Account, it is your sole
										responsibility to notify SPORTSDEY immediately and provide all relevant
										information related to your query, or as we may require for investigation.
									</p>
									<p>
										2. Upon termination of the Account, SPORTSDEY will return any funds used for
										active, open bets (excluding bonus funds, which will be forfeited) to your
										Account, unless such funds are not owed to you as per these Terms of Use or for
										any other reason. We reserve the right to withhold funds pending the outcome of
										any investigation where there is suspicion of a breach of these Terms or
										suspicious or fraudulent activity, or where we are required by law or regulatory
										authorities to do so.
									</p>
									<p>
										3. Sportsdey shall not be liable for any loss or inconvenience caused by the
										suspension or termination of your Account. In the event of Account termination,
										your only remedy shall be the return of any valid, undisputed funds remaining in
										your Account balance. SPORTSDEY will have no further liability thereafter.
									</p>
								</div>
							</div>
							<div>
								<p className="mb-2 font-semibold text-white">9. Reporting and Fraud Prevention</p>
								<div className="space-y-2 pl-4">
									<p>
										1. Sportsdey reserves the right to report your Account details to relevant
										sporting bodies, associations, authorities, police, or any investigatory or
										state authorities, as prescribed or permitted by law or applicable regulations.
										If we have reason to believe that you are involved in fraudulent, dishonest, or
										criminal activities, we reserve the right to refuse any bet or game wager, or
										any part thereof, and to void any accepted bets, withholding settlement as
										necessary. This may also apply in other situations where voiding a bet is
										required by applicable sport/event rules, or where instructed by a relevant
										regulator or authority.
									</p>
									<p>
										2. In cases of fraud, dishonesty, or criminal activity, you agree to indemnify
										SPORTSDEY and be held liable for any costs, charges, or losses we may incur,
										including direct, indirect, or consequential losses, loss of profit, and damage
										to our reputation. These costs or losses will be recoverable on demand.
									</p>
								</div>
							</div>
						</div>
					</section>

					<section id="deposits">
						<h2 className="mb-4 text-xl font-bold text-white">
							5. DEPOSITS AND WITHDRAWALS
						</h2>
						<div className="space-y-4 text-sm leading-relaxed text-[#C8C8C8]">
							<p>
								1. Deposits: You can deposit funds into your Sportsdey Account using one of the
								available payment methods. Sportsdey reserves the right to verify the ownership of the
								payment method(s) used to fund your Account by requesting supporting documentation from
								you. If you use a payment method that is not in your name (e.g., bank account, credit,
								or debit card), Sportsdey may suspend your Account or request additional information to
								confirm your authorisation to use the respective payment method. Your Account will remain
								suspended until the requested information is provided and verified. Any registered bank
								account must be from a Nigerian-licensed bank and registered in your name. If we
								determine that funds were deposited using a third-party payment method, we may refund the
								deposit to its source, void any bets, and withhold any winnings. Sportsdey does not
								charge fees for deposits made via bank transfers or cards, but your payment provider
								may. The minimum and maximum deposit limits depend on the payment method, and you can
								only bet up to the amount available in your Account. Refer to our FAQs for more
								information. Deposits related to bonus promotions will be governed by the respective
								bonus terms and may not be eligible for withdrawal.
							</p>
							<p>
								2. Account Use: Your Sportsdey Account is intended solely for accessing our Services
								under the Terms of Use. It is not a banking facility and will not accrue interest.
								Deposits should be made to place bets. If you appear to be depositing or withdrawing
								funds without genuine betting activity, Sportsdey may suspend or restrict your Account,
								and potentially terminate it. In such cases, we may deduct any bank charges from your
								Account without prior notice.
							</p>
							<p>
								3. Payment Methods: Sportsdey reserves the right to change the accepted payment methods
								at any time. Additionally, we may refuse to accept certain payment methods at our
								discretion, even if they were previously accepted.
							</p>
							<p>
								4. Withdrawals: You can withdraw your available cash balance (including winnings) by
								requesting a withdrawal to the bank account registered in your name, as outlined in
								Clause 1. Withdrawals are subject to verification processes, and we may suspend your
								withdrawal or Account until these checks are completed.
							</p>
							<p>
								5. Transaction Monitoring: Sportsdey reserves the right to reject withdrawals if they
								are associated with transactions that appear to be money transfers between payment
								methods, such as withdrawals of unplayed deposits. We may request evidence of payment
								method ownership to process withdrawals.
							</p>
							<p>6. Verification: Sportsdey may conduct verification checks at withdrawal, either internally or through third parties (including regulatory bodies). Withdrawals may be delayed or suspended during this process. As part of the verification, you may be required to provide documents such as:</p>
							<ol className="list-inside list-decimal space-y-1 pl-4">
								<li>A copy of your ID (front and rear).</li>
								<li>For credit card transactions, a copy of the card showing only the last 4 digits.</li>
								<li>A recent official document (e.g., bank statement) showing your name, address, bank account details, and relevant transactions.</li>
								<li>Any other relevant documents to complete the verification.</li>
							</ol>
							<p>
								7. Processing Time: Withdrawals are generally processed within 5 banking days, subject
								to the completion of verification checks. Sportsdey is not liable for any delays caused
								by your payment provider.
							</p>
							<p>
								8. Charge-backs: You must not initiate charge-backs, reversals, or cancellations of any
								deposits made to your Account. If Sportsdey incurs any charges due to these actions, we
								may deduct the relevant amounts from your Account balance.
							</p>
							<p>9. Withholding Payments: Sportsdey reserves the right to withhold payments and void bets if you breach these Terms of Use, including (but not limited to) if:</p>
							<ol className="list-inside list-decimal space-y-1 pl-4">
								<li>You were under 18 years old when you registered or placed a bet.</li>
								<li>You were in a jurisdiction where the use of our Services is illegal.</li>
								<li>A third party deposited funds or withdrew from your Account.</li>
								<li>We cannot verify your identity or any statements you made during your Account registration or use.</li>
							</ol>
							<p>
								10. If you owe money to Sportsdey for any reason, we reserve the right to offset the
								amount from your Account balance or winnings before allowing withdrawals.
							</p>
							<p>
								11. Tax Obligations: You are responsible for reporting any winnings to the appropriate
								tax authorities, as required by law.
							</p>
						</div>
					</section>

					<section id="placing-bets">
						<h2 className="mb-4 text-xl font-bold text-white">
							6. PLACING BETS
						</h2>
						<div className="space-y-4 text-sm leading-relaxed text-[#C8C8C8]">
							<div>
								<p className="mb-2 font-semibold text-white">1. Bet Acceptance</p>
								<div className="space-y-2 pl-4">
									<p>
										1. You acknowledge that Sportsdey is not obligated to accept any bet or wager
										and reserves the right to decline or limit any bet at its discretion.
									</p>
								</div>
							</div>
							<div>
								<p className="mb-2 font-semibold text-white">2. Sufficient Funds & Responsibility</p>
								<div className="space-y-2 pl-4">
									<p>
										1. Bets can only be placed if you have sufficient funds in your account. All
										bets are subject to the minimum stake requirements. When placing a bet, you must
										rely on your own judgment, and you are solely responsible for ensuring the
										accuracy of the bet under your account. It is your responsibility to review and
										understand the Terms of Use and any specific betting or gameplay terms
										applicable to your chosen service. These terms are available on the website and
										mobile application at all times. For any questions, please contact our Customer
										Services team. To view your bet details, visit your account.
									</p>
								</div>
							</div>
							<div>
								<p className="mb-2 font-semibold text-white">3. Bet Confirmation</p>
								<div className="space-y-2 pl-4">
									<p>1. All bets are subject to a maximum payout limit, which may be adjusted periodically. A bet is considered valid once accepted by Sportsdey's server and confirmed as follows:</p>
									<ol className="list-inside list-decimal space-y-1 pl-4">
										<li>For sports bets, when your bet slip appears in your account with a confirmation message and bet slip number.</li>
										<li>For game bets, when the bet ID appears in your account (an "Accepted Bet").</li>
									</ol>
									<p>
										2. Once a bet is confirmed as an Accepted Bet, it cannot be changed or
										cancelled. Only Accepted Bets will appear in your account and be considered
										valid.
									</p>
								</div>
							</div>
							<div>
								<p className="mb-2 font-semibold text-white">4. Liability & Winnings Settlement</p>
								<div className="space-y-2 pl-4">
									<p>
										1. Sportsdey is not responsible for settling bets that are not classified as
										Accepted Bets or deemed invalid. Winnings from valid, undisputed bets placed
										using your cash balance will be credited to your account upon settlement. These
										funds will remain in your account unless you request a withdrawal of part or
										all of your eligible balance.
									</p>
								</div>
							</div>
							<div>
								<p className="mb-2 font-semibold text-white">5. Right to Void Bets</p>
								<div className="space-y-2 pl-4">
									<p>1. Sportsdey reserves the right to withhold winnings and declare any bet void if we have evidence of any of the following:</p>
									<ol className="list-inside list-decimal space-y-1 pl-4">
										<li>Concerns regarding the integrity of the event.</li>
										<li>Manipulation of odds or betting pools.</li>
										<li>Evidence of match-fixing.</li>
										<li>The bettor was under 18 years of age at the time the bet was placed.</li>
										<li>The bettor was located in or a resident of a jurisdiction where placing the bet or accessing SPORTSDEY's services is illegal.</li>
										<li>Any other violations as outlined in the Terms of Use.</li>
									</ol>
								</div>
							</div>
						</div>
					</section>

					<section id="bonuses">
						<h2 className="mb-4 text-xl font-bold text-white">
							7. BONUSES / PROMOTIONS & REWARDS
						</h2>
						<div className="space-y-4 text-sm leading-relaxed text-[#C8C8C8]">
							<p>
								1. Sportsdey may offer bonuses, promotions, or reward programs through the Website,
								your registered email, or social media channels. You can find detailed information
								regarding these offers within your Account or in our help pages.
							</p>
							<p>
								2. Eligibility for bonuses, promotions, or participation in any reward programs will be
								subject to the specific terms and conditions of the respective offer, as provided on the
								Website or in your Account.
							</p>
							<p>
								3. SPORTSDEY reserves the right, at its sole discretion, to deny, modify, suspend, or
								terminate any bonuses, promotions, or special offers without prior notice. This includes
								changing their validity or discontinuing them entirely, without needing to inform the
								User in advance.
							</p>
						</div>
					</section>

					<section id="responsible-gaming">
						<h2 className="mb-4 text-xl font-bold text-white">
							8. RESPONSIBLE GAMING
						</h2>
						<div className="space-y-4 text-sm leading-relaxed text-[#C8C8C8]">
							<p>
								1. At SPORTSDEY, we are committed to Responsible Gaming and take our responsibilities
								in this area seriously. We encourage our Users to enjoy gambling as a fun and exciting
								activity, but remind you to always bet within your financial means. SPORTSDEY supports
								responsible betting practices and is dedicated to raising awareness about problem
								gambling, including enhancing prevention, intervention, and treatment efforts.
							</p>
							<p>
								2. We strive to provide an enjoyable and safe online gaming environment while
								recognising the potential financial risks associated with problem gambling. To help in
								this regard, we strongly recommend that Users:
							</p>
							<ol className="list-inside list-decimal space-y-1 pl-4">
								<li>Keep gambling separate from their daily activities.</li>
								<li>Consider the duration of each gaming session before it begins.</li>
								<li>Avoid treating gambling as a primary source of income or a means to recover debts.</li>
							</ol>
							<p>
								3. Users may request temporary or permanent self-exclusion from specific services or
								the entire platform by contacting Customer Service or accessing self-exclusion options
								through their Account. While we make every effort to enforce self-exclusion, Users
								acknowledge that SPORTSDEY is not liable if security measures are bypassed under
								circumstances beyond our reasonable control. You can access self-exclusion tools under
								your Account or contact us directly for assistance.
							</p>
						</div>
					</section>

					<section id="errors">
						<h2 className="mb-4 text-xl font-bold text-white">
							9. ERRORS AND OMISSIONS
						</h2>
						<div className="space-y-4 text-sm leading-relaxed text-[#C8C8C8]">
							<p>
								1. Effort to Maintain Accuracy: SPORTSDEY strives to ensure the accuracy of its
								systems and services made available through its website. However, occasional errors,
								whether human or technical, may occur. SPORTSDEY reserves the right to correct any
								identified error and to void any bets placed under such circumstances.
							</p>
							<p>2. Circumstances of Errors: Several situations may arise where a bet is accepted or a payment is made in error. Some examples of such circumstances include, but are not limited to:</p>
							<ol className="list-inside list-decimal space-y-1 pl-4">
								<li>When incorrect odds or bet terms are presented due to an obvious error or omission, or due to a system malfunction.</li>
								<li>The prices or terms offered before an event are significantly different from those generally available in the market; or the price or terms offered at the time of the bet are incorrect given the probability of the event.</li>
								<li>Bets accepted on a market that should have been suspended or had already concluded ("late bets").</li>
								<li>Errors resulting from fraudulent or prohibited activities under your account, or breaches of the Terms of Use.</li>
								<li>Bets accepted incorrectly under specific terms and conditions applicable to any service.</li>
								<li>Errors related to the amount of winnings/returns paid due to manual or system input errors.</li>
								<li>Errors concerning the amount of free bets and/or bonuses credited to your account.</li>
								<li>Acceptance of bets containing incompatible events due to human or technical error.</li>
								<li>System or communication errors in the generation of random numbers.</li>
								<li>Failures in any of our systems.</li>
							</ol>
							<p>3. Rights Regarding Errors: In the event of an Error, SPORTSDEY reserves the right to:</p>
							<ol className="list-inside list-decimal space-y-1 pl-4">
								<li>Correct the Error and re-settle the same bet at the correct price or terms that should have been available at the time the bet was placed. The bet will be deemed to have taken place on the usual terms.</li>
								<li>If correction and re-settlement are not practical, void the bet and return the stake to the account holder.</li>
								<li>If the Error resulted from fraudulent or prohibited activity, void the bet and terminate the account.</li>
							</ol>
							<p>
								4. Repayment of Overpaid Amounts: If an amount is wrongly credited or overpaid to your
								account, you agree to repay it immediately upon our request. You must inform SPORTSDEY
								as soon as possible of any incorrect credits to your account. We may rectify the Error
								by adjusting your account and cancelling bets or winnings resulting from the Error. We
								may also set off any such amounts against a positive balance on your account.
							</p>
							<p>
								5. Limitation of Liability: Neither SPORTSDEY, its officers, employees, agents, nor any
								of its partners or suppliers will be liable for any losses, including lost winnings,
								that result from an Error or any mistakes made by you while using our services.
							</p>
							<p>
								6. Duty to Inform: You must notify SPORTSDEY as soon as possible if you become aware
								of any Error and cease any related activity on the affected services.
							</p>
							<p>
								7. Reporting Errors: If you wish to report an Error or have any queries, please contact
								our Customer Support Team. Calls to our support team may be monitored or recorded for
								training and quality assurance purposes.
							</p>
							<p>
								8. Dispute Resolution: In the event of a discrepancy between the printed and web
								versions of a document or coupon, the web version shall prevail. In case of disputes,
								you agree that the records on our servers will serve as the final authority in
								determining the outcome.
							</p>
						</div>
					</section>

					<section id="no-warranty">
						<h2 className="mb-4 text-xl font-bold text-white">
							10. NO WARRANTY
						</h2>
						<div className="space-y-4 text-sm leading-relaxed text-[#C8C8C8]">
							<p>
								1. SPORTSDEY will strive to provide the Website and any associated Services with
								reasonable skill and care. However, we make no further warranty or representation,
								express or implied, regarding the Website and/or the Services. To the fullest extent
								permitted by law, all implied warranties or conditions relating to satisfactory quality,
								fitness for a particular purpose, completeness, or accuracy are expressly excluded.
							</p>
							<p>
								2. We do not guarantee uninterrupted access to any Information or Data on the Website
								or any part of it. The accuracy of the Information or Data, or the results derived from
								its use, is not warranted. The Information or Data provided is intended solely for
								informational purposes and is not to be considered as advice or recommendations. You
								are solely responsible for making any decisions when placing bets, which are done at
								your own risk and discretion.
							</p>
							<p>
								3. Furthermore, SPORTSDEY makes no guarantees that the Website or any of the Services
								will meet your expectations or that access will be uninterrupted, timely, secure, or
								error-free. We do not warrant that defects will be corrected, or that the Website, its
								server, or the Services are free from viruses, bugs, or other harmful components.
								Additionally, we do not guarantee the full functionality, accuracy, or reliability of
								the materials, nor the results or accuracy of any information you obtain through the
								Website.
							</p>
						</div>
					</section>

					<section id="limitations">
						<h2 className="mb-4 text-xl font-bold text-white">
							11. LIMITATIONS OF LIABILITY
						</h2>
						<div className="space-y-4 text-sm leading-relaxed text-[#C8C8C8]">
							<p>
								1. You acknowledge that your use of the SPORTSDEY website and any associated services
								is entirely at your own risk.
							</p>
							<p>
								2. SPORTSDEY accepts no responsibility for any damages, liabilities, or losses of any
								kind that may arise from or be related to your use of the website, any of its content,
								your account, or the services provided. This includes but is not limited to, delays or
								interruptions in operation or transmission, communication failures, misuse of the
								website, the mobile application, your account, or any errors. SPORTSDEY will not be
								liable to you in contract, tort (including negligence), breach of statutory duty, or
								otherwise for:
							</p>
							<ol className="list-inside list-decimal space-y-1 pl-4">
								<li>loss of business,</li>
								<li>loss of profits,</li>
								<li>loss of revenue,</li>
								<li>loss of data,</li>
								<li>loss of opportunities,</li>
								<li>loss of goodwill or reputation,</li>
								<li>any special, indirect, or consequential loss arising out of or in connection with your use of the website, services, account activities, or these Terms of Use, even if such losses are foreseeable or you have informed us of their possibility.</li>
							</ol>
							<p>
								3. SPORTSDEY is not responsible for any loss of content or material uploaded or
								transmitted via the website, your account, or otherwise provided to us.
							</p>
							<p>
								4. SPORTSDEY will not be liable to you or any third party for any modifications,
								suspensions, or discontinuations of services or any part thereof. We reserve the right
								to cancel or suspend the services without liability.
							</p>
							<p>
								5. SPORTSDEY will not be responsible for any loss or damage caused by factors beyond
								our control, including but not limited to acts of God, power outages, labour disputes,
								actions or inactions of any government authority, failures or interruptions of
								telecommunications services, or any other act, omission, or failure caused by third
								parties.
							</p>
							<p>6. SPORTSDEY's maximum liability to you in connection with these Terms of Use, whether for breach of contract, tort (including negligence), or otherwise, will be limited to:</p>
							<ol className="list-inside list-decimal space-y-1 pl-4">
								<li>the amount of the relevant bet that resulted in the liability, and</li>
								<li>in cases where funds deposited by you have been misplaced by us, the return of the misplaced amount to your account.</li>
							</ol>
							<p>
								7. Nothing in this clause limits SPORTSDEY's obligation to pay out winnings or any
								other amounts properly due to you, subject to the Terms of Use and any applicable
								maximum winnings limits.
							</p>
							<p>
								8. Nothing in these Terms of Use will exclude or limit SPORTSDEY's liability for any
								matter that cannot legally be excluded under applicable law.
							</p>
						</div>
					</section>

					<section id="intellectual-property">
						<h2 className="mb-4 text-xl font-bold text-white">
							12. INTELLECTUAL PROPERTY RIGHTS
						</h2>
						<div className="space-y-4 text-sm leading-relaxed text-[#C8C8C8]">
							<p>
								1. You acknowledge and agree that all intellectual property rights in our Website, the
								Services, and/or any related Information or Data shall at all times remain vested in
								Sportsdey or its licensors. These intellectual property rights include, without
								limitation, copyright, trademarks, the underlying software, design, graphics, layout,
								look and feel, and structure of our Website and Services, as well as database rights,
								design rights, domain names, and goodwill or rights to sue for passing off. You are
								authorized to use this material and content only as expressly permitted by us or our
								licensors, and solely for the purposes outlined in these Terms and Conditions. Our
								licensors reserve the right to enforce any of their intellectual property rights in any
								of the content, including but not limited to, Information, Data, and/or Services,
								directly against you.
							</p>
							<p>
								2. You agree not to (and not to assist or facilitate any third party to) copy,
								reproduce, transmit, publish, display, distribute, commercially exploit, tamper with,
								or create derivative works from such material and content.
							</p>
						</div>
					</section>

					<section id="complaints">
						<h2 className="mb-4 text-xl font-bold text-white">
							13. COMPLAINTS AND CLAIMS
						</h2>
						<div className="space-y-4 text-sm leading-relaxed text-[#C8C8C8]">
							<p>
								1. All complaints related to a bet placed through the Services or a game played must be
								communicated to Sportsdey email at CustomerService@Sportsdey.com within 10 (ten)
								calendar days from the date the bet is settled, or if still pending, from the date of
								bet acceptance. All complaints must be directed to Customer Services at
								CustomerService@Sportsdey.com and should include your Account User ID along with the
								details of the bet in question.
							</p>
							<p>
								2. Any claims concerning unresolved complaints or disputes regarding the outcome of a
								complaint resolution must be submitted in writing to Sportsdey's Customer Services
								email at CustomerService@Sportsdey.com within 5 (five) calendar days from the date of
								the complaint's resolution. Be sure to provide your Account User ID, the details of
								the bet related to your claim, and copies of relevant correspondence with Customer
								Services. Claims submitted with incomplete information or after the 5-day deadline
								will be disregarded.
							</p>
							<p>
								3. Without prejudice to any rights provided under these Terms and Conditions or by
								law, Sportsdey reserves the right to suspend your Account, refuse the acceptance of
								any bets, and/or withdraw or deny any promotional offers under your Account upon
								receiving a claim and until its complete resolution.
							</p>
							<p>
								4. Without prejudice to the provisions in these terms and conditions, the User
								acknowledges that the outcomes of games played through the Services are determined by a
								random number generator, where applicable, and the results displayed on the game server
								shall always prevail. Additionally, you agree that the server records will serve as the
								final authority in determining the terms, circumstances, and results of your use of the
								Services.
							</p>
							<p>
								5. Offensive or inappropriate language, as well as malicious or damaging comments, will
								not be tolerated when communicating with our staff or when discussing our products and
								services on any media, network, or forum. Any violation of this policy may result in
								suspension or termination of your Account, and any other action or remedy permitted by
								law may be applied.
							</p>
						</div>
					</section>

					<section id="waiver">
						<h2 className="mb-4 text-xl font-bold text-white">
							14. WAIVER
						</h2>
						<div className="space-y-4 text-sm leading-relaxed text-[#C8C8C8]">
							<p>
								1. If SPORTSDEY fails to insist upon strict performance of any of your obligations or
								fails to exercise any of the rights or remedies to which we are entitled, this shall
								not constitute a waiver of such rights or remedies and shall not relieve you from
								compliance with such obligations. A waiver by SPORTSDEY of any default shall not
								constitute a waiver of any subsequent default. No waiver by SPORTSDEY shall be
								effective unless provided in writing, excluding email.
							</p>
						</div>
					</section>

					<section id="severability">
						<h2 className="mb-4 text-xl font-bold text-white">
							15. SEVERABILITY
						</h2>
						<div className="space-y-4 text-sm leading-relaxed text-[#C8C8C8]">
							<p>
								1. If any provision of these Terms of Use is found by any court or administrative body
								of competent jurisdiction to be invalid or unenforceable, such invalidity or
								unenforceability shall not affect the other provisions of the Terms of Use, which shall
								remain in full force and effect. In such cases, the part declared invalid or
								unenforceable shall be amended in a manner consistent with applicable law to reflect,
								as closely as possible, SPORTSDEY's original intent.
							</p>
						</div>
					</section>

					<section id="assignment">
						<h2 className="mb-4 text-xl font-bold text-white">
							16. ASSIGNMENT AND TRANSFER
						</h2>
						<div className="space-y-4 text-sm leading-relaxed text-[#C8C8C8]">
							<p>
								1. You may not assign, transfer, charge, or otherwise deal with your rights and/or
								obligations under these Terms of Use without our prior written consent. SPORTSDEY
								reserves the right to assign, transfer, charge, or otherwise deal with its rights under
								these Terms of Use as deemed necessary.
							</p>
						</div>
					</section>

					<section id="relationship">
						<h2 className="mb-4 text-xl font-bold text-white">
							17. RELATIONSHIP AND THIRD PARTY RIGHTS
						</h2>
						<div className="space-y-4 text-sm leading-relaxed text-[#C8C8C8]">
							<p>
								1. Nothing in these Terms of Use shall create or be deemed to create a partnership,
								joint venture, or principal-agent relationship between the User and SPORTSDEY.
							</p>
							<p>
								2. Unless expressly stated, nothing in these Terms of Use shall create or confer any
								rights or any other benefits, whether by statute or otherwise, in favour of any person
								other than you and SPORTSDEY, respectively.
							</p>
						</div>
					</section>

					<section id="applicable-law">
						<h2 className="mb-4 text-xl font-bold text-white">
							18. APPLICABLE LAW AND PLACE OF JURISDICTION
						</h2>
						<div className="space-y-4 text-sm leading-relaxed text-[#C8C8C8]">
							<p>
								1. These Terms of Use shall be governed by and interpreted under the laws of Nigeria.
								You irrevocably submit to the non-exclusive jurisdiction of the courts of Nigeria
								concerning any dispute related to these Terms of Use.
							</p>
							<p>
								2. Any bet placed by the User shall be governed by the applicable provisions of the
								Nigerian Criminal Code Act, CAP. 22, and any regulations and rules made under it, as
								amended from time to time. It is the responsibility of the User to ensure that they
								are aware of these provisions.
							</p>
						</div>
					</section>

					<section id="entire-agreement">
						<h2 className="mb-4 text-xl font-bold text-white">
							19. ENTIRE AGREEMENT
						</h2>
						<div className="space-y-4 text-sm leading-relaxed text-[#C8C8C8]">
							<p>
								1. These Terms of Use, along with any document expressly referred to in them and any
								guidelines or rules posted on the Website, represent the entire agreement between
								SPORTSDEY and the User concerning the subject matter of the Terms of Use and supersede
								any prior agreements, understandings, or arrangements, whether oral or written.
							</p>
							<p>
								The current version of the Terms of Use applies to the latest version of the Website
								or any of its components.
							</p>
						</div>
					</section>
				</div>

				<div className="mt-12 border-t border-[#1B2722] pt-8 text-center">
					<p className="text-xs text-[#A0A0A0]">
						© 2026 Sportsdey, All Right Reserved.
					</p>
				</div>
			</div>
			<button
				onClick={scrollToTop}
				className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[#18b100] text-white shadow-lg transition-all hover:bg-[#14a000] hover:shadow-xl"
				aria-label="Back to top"
			>
				<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M10 16V4M10 4L5 9M10 4L15 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
				</svg>
			</button>
		</div>
	);
}
