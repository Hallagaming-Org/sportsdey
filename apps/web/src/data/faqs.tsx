export type FAQ = {
	question: string;
	answer: React.ReactNode;
};

export const faqs: FAQ[] = [
	{
		question: "How do I register on SportsDey?",
		answer:
			"Click on “Register” in the top-right corner, enter your registration details, and follow the steps given.",
	},
	{
		question: "Can I change my username?",
		answer:
			"Unfortunately, no, the username must be a verified phone number that you have chosen during the registration process cannot be changed once you have created your account.",
	},
	{
		question: "How do I recover my password?",
		answer:
			"To retrieve your password, please click on “Forgot Password?” below the login area. If you have forgotten your e-mail or have issues with your phone number, please contact us.",
	},
	{
		question: "How do I change my password?",
		answer:
			'Log into your account, go to the "My Profile" drop-down menu then click on "Change Password" at the top of the page.',
	},
	{
		question: "How do I update my personal details?",
		answer:
			'Login into your account, go to the "My Profile" drop-down menu, and click on "Personal". You can then change the permitted fields as desired.',
	},
	{
		question: "Where can I find Sportsdey's Terms & Conditions?",
		answer:
			"You can find our Terms and Conditions at the bottom of the website (footer) or check here: sportsdey.com",
	},
	{
		question: "What is the maximum payout?",
		answer: "The maximum sports payout per bet is NGN 50,000,000.",
	},
	{
		question: "How many selections can I add to my betslip?",
		answer:
			"The maximum number of selections you can add to your betslip is 50.",
	},
	{
		question: "How can I withdraw my money?",
		answer:
			'To withdraw your winnings, simply go to "My Profile" and find the "Withdrawals" button. Enter the desirable amount to withdraw and click on “Withdraw”. Your winnings will be immediately sent to your Bank account after your confirmation.',
	},
	{
		question: "Are there any fees for withdrawals?",
		answer: "All withdrawals are free of charge.",
	},
	{
		question: "What is the usual withdrawal processing time?",
		answer:
			"Withdrawals are processed within 30minutes during the operating hours of 9am to 11:59pm. Withdrawals outside the operating hours will be treated the next morning.",
	},
	{
		question: "Why was my money deducted suddenly?",
		answer:
			"If our bookmakers provide the wrong information for the results of bets, the bets will then also be cleared up in accordance with the wrong results. When this happens, a rollback notification will be sent if such a situation occurs to any of your bets. We will then re-settle any related bets in accordance with the real and correct results. This process usually happens either during the match, or shortly after the game ends, when it’s being reviewed. The balance of your account may turn out to be negative after a rollback. This happens when a customer spends his winnings or has withdrawn his winnings before the rollback occurred. For more information, refer to your account details in the Transaction History area.",
	},
	{
		question: "What is the minimum and maximum deposit amount?",
		answer:
			"The minimum deposit amount is N100 while the maximum deposit amount is dependent on the payment provider. These limits are visible on the deposit page for each provider.",
	},
	{
		question: "How can I set my account on self-exclusion?",
		answer:
			"Log into your account, go to your profile and locate the ‘limits’ tab and click ‘’add limits’’ to select the specific limits you want to set. You can then self-exclude yourself for the duration you want. Note that once you self-exclude, you have to wait for the time duration set before you can resume betting activities again.",
	},
	{
		question: "How can I change the name on my account?",
		answer:
			"The name on your account cannot be changed, during the registration process, you were asked to ensure that your registered name on the platform corresponds with your bank account/ID name.",
	},
	{
		question:
			"Can I open another account? I am always losing on my current account.",
		answer:
			"No, you cannot open multiple accounts. It’s one account per player. Reach out to our Customer Support team so we can review your account and advise you accordingly.",
	},
	{
		question: "Can I change or cancel a bet after placing it?",
		answer:
			"No, once a bet has been placed, you cannot change or cancel the bet. You can however cash-out the bet but you will lose a small portion of your original bet amount.",
	},
	{
		question: "Where is my welcome bonus? How do I claim it?",
		answer:
			"If you have met the conditions of the welcome bonus, you will see the bonus options available while making your deposit. If this was not selected during deposit, this may be the reason why you are unable to see your welcome bonus. Please contact our Customer Support team for further checks. You can also check the bonus section via your account profile to view the status of your pending bonuses.",
	},
	{
		question: "Why is my deposit not reflecting?",
		answer:
			"Once you make a deposit, it should reflect instantly in your account. However, if it is not yet reflecting, there could be a connection failure between the payment provider and our platform, please send a proof of your deposit to our Customer Support team for resolution.",
	},
	{
		question: "What does handicap bets mean?",
		answer:
			"Handicap bet means that before the game starts, you are putting one of the teams at an advantage over the other and predicting an outcome for the other team despite the disadvantage.",
	},
	{
		question: "Why was I logged out, or is my account restricted?",
		answer:
			"There are several reasons why you may be unable to log into your account. Please reach out to our Customer Support team so that a check can be conducted on your account.",
	},
	{
		question: "How do I find out about the latest promotions and offers?",
		answer:
			"General promotions are available in the promotions tab on the website. However, personalized promotions are sent via email, inbox messages or SMS. If you are not receiving our messages, it means you did not tick to accept receiving our messages during registration. If you wish to resume receiving our messages, please reach out to our Customer Support team.",
	},
	{
		question: "Change of Information",
		answer: (
			<div className="space-y-2">
				<p>We acknowledge receipt of your mail to change your information.</p>
				<p>
					Please provide the following information which is required for
					verification purposes before the information can be changed:
				</p>
				<ul className="list-disc space-y-1 pl-5">
					<li>Name of the account</li>
					<li>Date of Birth</li>
					<li>Phone number</li>
					<li>Address</li>
					<li>Valid ID</li>
					<li>Last deposit</li>
				</ul>
				<p>Kindly also, state the information you want to change.</p>
			</div>
		),
	},
	{
		question: "Self-Exclusion (Self exclusion)",
		answer: (
			<div className="space-y-2">
				<p>
					Sportsdey Self-Exclusion option allows players to close their accounts
					for a specified time period. During this period, players will not be
					able to bet or play games, although players can still log in to
					withdraw funds. As per SportsDey's risk management procedures, the
					balance will not be withdraw-able if it has not been previously
					staked.
				</p>
				<p>
					Self-exclusion placed on accounts will not be lifted by SportsDey
					until the exclusion period willfully selected by the user naturally
					elapses. Also, users who have opted for self-exclusion are prohibited
					from creating new SportsDey accounts during the self-exclusion period.
					Any account found to have been created during the self-exclusion
					period will be closed immediately without recourse to the user.
				</p>
			</div>
		),
	},
	{
		question: "Account Verification (KYC)",
		answer: (
			<div className="space-y-2">
				<p>To verify your account, please provide the following documents:</p>
				<ul className="list-disc space-y-1 pl-5">
					<li>
						Valid ID: NIN Slip, Voter’s card, Driver’s License, or International
						Passport.
					</li>
					<li>Deposit proof</li>
				</ul>
			</div>
		),
	},
];
