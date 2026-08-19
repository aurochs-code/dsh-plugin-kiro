window.__ModuleLoader__.load({
	id: "dsh-plugin-kiro",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/effort.ts
		/** Kiro CLI effort levels accepted by both `chat` and `acp`. */
		const KIRO_REASONING_EFFORTS = [
			{
				id: "low",
				name: "Low",
				description: "Fastest responses with the least reasoning."
			},
			{
				id: "medium",
				name: "Medium",
				description: "Balanced speed and reasoning depth."
			},
			{
				id: "high",
				name: "High",
				description: "More deliberate reasoning for complex work."
			},
			{
				id: "xhigh",
				name: "Extra High",
				description: "Maximum depth short of the full maximum setting."
			},
			{
				id: "max",
				name: "Maximum",
				description: "Highest available reasoning effort."
			}
		];
		//#endregion
		//#region src/client/KiroSettingsCard.tsx
		const FIELDS = [
			"command",
			"cwd",
			"apiKeyEnv",
			"defaultEffort"
		];
		const QUOTA_HELP_URL = "https://kiro.dev/docs/cli/billing/subscription-portal/";
		function isRecord$1(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value);
		}
		function stringValue(value, fallback = "") {
			return typeof value === "string" ? value : fallback;
		}
		function toDraft(value) {
			return {
				command: stringValue(value?.command, "kiro-cli"),
				cwd: stringValue(value?.cwd),
				apiKeyEnv: stringValue(value?.apiKeyEnv, "KIRO_API_KEY"),
				defaultEffort: stringValue(value?.defaultEffort)
			};
		}
		function sameDraft(left, right) {
			return FIELDS.every((field) => left[field] === right[field]);
		}
		function hasField(value, field) {
			return isRecord$1(value) && field in value;
		}
		const styles = {
			card: {
				listStyle: "none",
				border: "1px solid var(--dsw-alias-border-l2)",
				borderRadius: 12,
				background: "var(--dsw-alias-bg-layer-3)",
				color: "var(--dsw-alias-label-primary)",
				overflow: "hidden"
			},
			header: {
				appearance: "none",
				width: "100%",
				display: "flex",
				alignItems: "center",
				gap: 12,
				padding: "14px 16px",
				border: 0,
				background: "transparent",
				color: "inherit",
				textAlign: "left",
				cursor: "pointer",
				font: "inherit"
			},
			mark: {
				display: "inline-flex",
				width: 24,
				height: 24,
				alignItems: "center",
				justifyContent: "center",
				flexShrink: 0,
				borderRadius: 7,
				background: "var(--dsw-alias-bg-module-platform)",
				color: "var(--dsw-alias-state-warn-label)",
				fontSize: 12,
				fontWeight: 700,
				letterSpacing: "0.04em"
			},
			heading: {
				display: "flex",
				flexDirection: "column",
				gap: 3,
				minWidth: 0,
				flex: 1
			},
			name: {
				fontSize: 15,
				lineHeight: 1.4,
				fontWeight: 600
			},
			description: {
				fontSize: 13,
				lineHeight: 1.5,
				color: "var(--dsw-alias-label-tertiary)"
			},
			badge: {
				flexShrink: 0,
				borderRadius: 999,
				padding: "1px 8px",
				background: "var(--dsw-alias-bg-module-platform)",
				color: "var(--dsw-alias-label-secondary)",
				fontSize: 11,
				fontWeight: 500,
				lineHeight: "17px"
			},
			chevron: {
				flexShrink: 0,
				color: "var(--dsw-alias-label-tertiary)",
				fontSize: 18,
				lineHeight: 1
			},
			body: {
				margin: "0 16px",
				borderTop: "1px solid var(--dsw-alias-border-l2)",
				padding: "4px 0 12px"
			},
			field: {
				display: "flex",
				flexDirection: "column",
				gap: 6,
				padding: "12px 0",
				borderBottom: "1px solid var(--dsw-alias-border-l2)"
			},
			fieldHead: {
				display: "flex",
				alignItems: "center",
				gap: 8
			},
			label: {
				minWidth: 0,
				flex: 1,
				fontSize: 13,
				fontWeight: 500,
				lineHeight: 1.5
			},
			smallBadge: {
				borderRadius: 999,
				padding: "1px 8px",
				background: "var(--dsw-alias-bg-module-platform)",
				color: "var(--dsw-alias-label-secondary)",
				fontSize: 11,
				lineHeight: "17px"
			},
			reset: {
				padding: 0,
				border: 0,
				background: "transparent",
				color: "var(--dsw-alias-label-secondary)",
				cursor: "pointer",
				font: "inherit",
				fontSize: 12,
				lineHeight: 1.5
			},
			input: {
				height: 34,
				boxSizing: "border-box",
				border: "1px solid var(--dsw-alias-border-l2)",
				borderRadius: 8,
				padding: "0 12px",
				background: "var(--dsw-alias-bg-layer-3)",
				color: "var(--dsw-alias-label-primary)",
				font: "inherit",
				fontSize: 13,
				lineHeight: 1.5
			},
			hint: {
				margin: 0,
				color: "var(--dsw-alias-label-tertiary)",
				fontSize: 12,
				lineHeight: 1.5
			},
			invalid: {
				margin: 0,
				color: "var(--dsw-alias-label-error)",
				fontSize: 12,
				lineHeight: 1.5
			},
			callout: {
				display: "flex",
				flexDirection: "column",
				gap: 5,
				marginTop: 12,
				padding: "10px 12px",
				borderLeft: "3px solid var(--dsw-alias-state-warn-label)",
				borderRadius: "0 8px 8px 0",
				background: "var(--dsw-alias-bg-module-platform)"
			},
			calloutTitle: {
				fontSize: 12,
				fontWeight: 600,
				lineHeight: 1.5,
				color: "var(--dsw-alias-label-secondary)"
			},
			link: {
				alignSelf: "flex-start",
				color: "var(--dsw-alias-brand-primary)",
				fontSize: 12,
				lineHeight: 1.5
			},
			footer: {
				display: "flex",
				alignItems: "center",
				justifyContent: "flex-end",
				gap: 8,
				paddingTop: 12,
				flexWrap: "wrap"
			},
			failure: {
				flex: 1,
				margin: 0,
				color: "var(--dsw-alias-label-error)",
				fontSize: 12,
				lineHeight: 1.5
			},
			button: {
				appearance: "none",
				border: "1px solid var(--dsw-alias-border-l2)",
				borderRadius: 8,
				padding: "5px 14px",
				background: "transparent",
				color: "var(--dsw-alias-label-secondary)",
				cursor: "pointer",
				font: "inherit",
				fontSize: 13,
				lineHeight: 1.5
			},
			save: {
				appearance: "none",
				border: "1px solid transparent",
				borderRadius: 8,
				padding: "5px 14px",
				background: "var(--dsw-alias-label-primary)",
				color: "var(--dsw-alias-bg-layer-3)",
				cursor: "pointer",
				font: "inherit",
				fontSize: 13,
				lineHeight: 1.5
			},
			authStatus: {
				margin: 0,
				color: "var(--dsw-alias-label-secondary)",
				fontSize: 12,
				lineHeight: 1.5
			},
			authIdentity: {
				margin: 0,
				color: "var(--dsw-alias-label-tertiary)",
				fontSize: 12,
				lineHeight: 1.5
			},
			authActions: {
				display: "flex",
				alignItems: "center",
				gap: 8,
				flexWrap: "wrap",
				marginTop: 4
			},
			authCode: {
				display: "inline-flex",
				alignSelf: "flex-start",
				border: "1px solid var(--dsw-alias-border-l2)",
				borderRadius: 8,
				padding: "5px 8px",
				background: "var(--dsw-alias-bg-layer-3)",
				color: "var(--dsw-alias-label-primary)",
				fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
				fontSize: 13,
				letterSpacing: "0.06em"
			}
		};
		function useSettingsSnapshot(scope) {
			const subscribe = (0, react.useCallback)((listener) => scope.subscribe(listener), [scope]);
			const getSnapshot = (0, react.useCallback)(() => scope.getSnapshot(), [scope]);
			return (0, react.useSyncExternalStore)(subscribe, getSnapshot, getSnapshot);
		}
		function Field(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				style: styles.field,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						style: styles.fieldHead,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: styles.label,
								children: props.label
							}),
							props.override ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: styles.smallBadge,
								children: props.t("overridden")
							}) : null,
							props.override ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: styles.reset,
								disabled: props.disabled,
								onClick: props.onReset,
								children: props.t("reset")
							}) : null
						]
					}),
					props.isSelect ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
						"aria-label": props.label,
						style: styles.input,
						value: props.value,
						disabled: props.disabled,
						onChange: (event) => props.onChange(event.target.value),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: "",
							children: props.t("kiroDefault")
						}), KIRO_REASONING_EFFORTS.map((effort) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: effort.id,
							children: effort.name
						}, effort.id))]
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						"aria-label": props.label,
						style: {
							...styles.input,
							...props.invalid ? { borderColor: "var(--dsw-alias-label-error)" } : {}
						},
						value: props.value,
						disabled: props.disabled,
						onChange: (event) => props.onChange(event.target.value)
					}),
					props.invalid ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: styles.invalid,
						children: props.t("required")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: styles.hint,
						children: props.hint
					})
				]
			});
		}
		function authenticationLabel(status, t) {
			if (status === void 0) return t("authLoading");
			if (status.login.state === "waiting") return t("authWaiting");
			if (status.state === "authenticated") return t("authConnected");
			if (status.login.state === "complete") return t("authComplete");
			if (status.login.state === "failed") return t("authFailed");
			if (status.login.state === "cancelled") return t("authCancelled");
			if (status.login.state === "expired") return t("authExpired");
			if (status.state === "signed-out") return t("authSignedOut");
			return t("authUnavailable");
		}
		function KiroAuthenticationPanel(props) {
			const [status, setStatus] = (0, react.useState)();
			const [loading, setLoading] = (0, react.useState)(false);
			const [failed, setFailed] = (0, react.useState)(false);
			const request = (0, react.useCallback)(async (action) => {
				setLoading(true);
				setFailed(false);
				try {
					const next = action === "status" ? await props.authentication.status() : action === "enterprise-login" ? await props.authentication.startEnterpriseLogin() : await props.authentication.cancelLogin();
					setStatus(next);
				} catch {
					setFailed(true);
				} finally {
					setLoading(false);
				}
			}, [props.authentication]);
			(0, react.useEffect)(() => {
				if (!props.available) return;
				request("status");
			}, [props.available, request]);
			const waiting = status?.login.state === "waiting";
			(0, react.useEffect)(() => {
				if (!props.available || !waiting) return;
				const timer = window.setInterval(() => {
					request("status");
				}, 1500);
				return () => window.clearInterval(timer);
			}, [
				props.available,
				request,
				waiting
			]);
			const identity = [status?.identity?.email, status?.identity?.accountType].filter((value) => value !== void 0).join(" · ");
			const canStart = props.available && !props.disabled && !loading && !waiting;
			const device = status?.login;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: styles.callout,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: styles.calloutTitle,
						children: props.t("authTitle")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: styles.hint,
						children: props.t("authBody")
					}),
					props.available ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "status",
						style: styles.authStatus,
						children: authenticationLabel(status, props.t)
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: styles.authStatus,
						children: props.t("authLocalOnly")
					}),
					identity.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: styles.authIdentity,
						children: identity
					}) : null,
					props.available && waiting ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						device?.code === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: styles.hint,
							children: props.t("authPreparing")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
							style: styles.authCode,
							children: device.code
						}),
						device?.url === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
							style: styles.link,
							href: device.url,
							target: "_blank",
							rel: "noreferrer",
							children: props.t("authOpenBrowser")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: styles.hint,
							children: props.t("authDeviceHint")
						})
					] }) : null,
					props.available && props.disabled ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: styles.hint,
						children: props.t("authSaveFirst")
					}) : null,
					failed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "status",
						style: styles.failure,
						children: props.t("authRequestFailed")
					}) : null,
					props.available ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: styles.authActions,
						children: [waiting ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: styles.button,
							disabled: loading,
							onClick: () => {
								request("cancel-login");
							},
							children: props.t("authCancel")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: styles.save,
							disabled: !canStart,
							onClick: () => {
								request("enterprise-login");
							},
							children: status?.state === "authenticated" ? props.t("authRelogin") : props.t("authEnterpriseLogin")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: styles.button,
							disabled: loading,
							onClick: () => {
								request("status");
							},
							children: props.t("authRefresh")
						})]
					}) : null
				]
			});
		}
		function KiroSettingsCardBody({ scope, t, authentication, canManageAuthentication }) {
			const snapshot = useSettingsSnapshot(scope);
			const [open, setOpen] = (0, react.useState)(false);
			const [draft, setDraft] = (0, react.useState)(() => toDraft(void 0));
			const [baseline, setBaseline] = (0, react.useState)(() => toDraft(void 0));
			const [resets, setResets] = (0, react.useState)(() => /* @__PURE__ */ new Set());
			const [saving, setSaving] = (0, react.useState)(false);
			const [failed, setFailed] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				if (snapshot.status !== "ready") return;
				const next = toDraft(snapshot.value);
				setDraft(next);
				setBaseline(next);
				setResets(/* @__PURE__ */ new Set());
				setFailed(false);
			}, [
				snapshot.status,
				snapshot.revision,
				snapshot.value
			]);
			if (snapshot.status === "unavailable") return null;
			const overrides = Object.fromEntries(FIELDS.map((field) => [field, hasField(snapshot.user, field)]));
			const invalid = draft.command.trim().length === 0 || draft.apiKeyEnv.trim().length === 0;
			const dirty = resets.size > 0 || !sameDraft(draft, baseline);
			const disabled = snapshot.status !== "ready" || !snapshot.writable || saving;
			const edit = (field, value) => {
				setDraft((current) => ({
					...current,
					[field]: value
				}));
				setResets((current) => {
					if (!current.has(field)) return current;
					const next = new Set(current);
					next.delete(field);
					return next;
				});
				setFailed(false);
			};
			const reset = (field) => {
				const base = toDraft(isRecord$1(snapshot.base) ? snapshot.base : void 0);
				setDraft((current) => ({
					...current,
					[field]: base[field]
				}));
				setResets((current) => new Set(current).add(field));
				setFailed(false);
			};
			const discard = () => {
				setDraft(baseline);
				setResets(/* @__PURE__ */ new Set());
				setFailed(false);
			};
			const save = async () => {
				if (!dirty || invalid || disabled) return;
				setSaving(true);
				setFailed(false);
				try {
					for (const field of FIELDS) if (resets.has(field) || (field === "cwd" || field === "defaultEffort") && draft[field] === "") await scope.unset(field);
					else if (draft[field] !== baseline[field]) await scope.set(field, draft[field].trim());
					const accepted = toDraft(scope.getSnapshot().value);
					setDraft(accepted);
					setBaseline(accepted);
					setResets(/* @__PURE__ */ new Set());
				} catch {
					setFailed(true);
				} finally {
					setSaving(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				style: styles.card,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					style: styles.header,
					"aria-expanded": open,
					"aria-label": `${t(open ? "collapse" : "expand")}: ${t("title")}`,
					onClick: () => setOpen((current) => !current),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: styles.mark,
							children: "ACP"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							style: styles.heading,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: styles.name,
								children: t("title")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: styles.description,
								children: snapshot.status === "loading" ? t("loading") : t("description")
							})]
						}),
						dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: styles.badge,
							children: t("unsaved")
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: styles.chevron,
							children: open ? "⌃" : "⌄"
						})
					]
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: styles.body,
					children: [
						!snapshot.writable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: styles.hint,
							children: t("readOnly")
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							field: "command",
							label: t("command"),
							hint: t("commandHint"),
							value: draft.command,
							override: overrides.command,
							invalid: draft.command.trim().length === 0,
							disabled,
							t,
							onChange: (value) => edit("command", value),
							onReset: () => reset("command")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							field: "cwd",
							label: t("cwd"),
							hint: t("cwdHint"),
							value: draft.cwd,
							override: overrides.cwd,
							invalid: false,
							disabled,
							t,
							onChange: (value) => edit("cwd", value),
							onReset: () => reset("cwd")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							field: "apiKeyEnv",
							label: t("apiKeyEnv"),
							hint: t("apiKeyEnvHint"),
							value: draft.apiKeyEnv,
							override: overrides.apiKeyEnv,
							invalid: draft.apiKeyEnv.trim().length === 0,
							disabled,
							t,
							onChange: (value) => edit("apiKeyEnv", value),
							onReset: () => reset("apiKeyEnv")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							field: "defaultEffort",
							label: t("defaultEffort"),
							hint: t("defaultEffortHint"),
							value: draft.defaultEffort,
							override: overrides.defaultEffort,
							invalid: false,
							disabled,
							isSelect: true,
							t,
							onChange: (value) => edit("defaultEffort", value),
							onReset: () => reset("defaultEffort")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(KiroAuthenticationPanel, {
							authentication,
							available: canManageAuthentication,
							disabled: dirty || snapshot.status !== "ready",
							t
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: styles.callout,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: styles.calloutTitle,
								children: t("cacheTitle")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: styles.hint,
								children: t("cacheBody")
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: styles.callout,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: styles.calloutTitle,
									children: t("quotaTitle")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: styles.hint,
									children: t("quotaBody")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
									style: styles.link,
									href: QUOTA_HELP_URL,
									target: "_blank",
									rel: "noreferrer",
									children: t("quotaLink")
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: styles.footer,
							children: [
								failed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									role: "status",
									style: styles.failure,
									children: t("saveFailed")
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									style: styles.button,
									disabled: !dirty || saving,
									onClick: discard,
									children: t("discard")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									style: styles.save,
									disabled: !dirty || invalid || disabled,
									onClick: () => {
										save();
									},
									children: t(saving ? "saving" : "save")
								})
							]
						})
					]
				}) : null]
			});
		}
		function KiroSettingsCard(props) {
			if (props.scope === void 0 || props.t === void 0 || props.authentication === void 0 || props.canManageAuthentication === void 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(KiroSettingsCardBody, {
				scope: props.scope,
				t: props.t,
				authentication: props.authentication,
				canManageAuthentication: props.canManageAuthentication
			});
		}
		//#endregion
		//#region src/client/kiro-auth.ts
		function isRecord(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value);
		}
		function optionalString(value) {
			return typeof value === "string" && value.length > 0 ? value : void 0;
		}
		function statusValue(value) {
			if (!isRecord(value)) throw new Error("Kiro authentication returned an invalid response.");
			const state = value.state;
			const login = value.login;
			if (state !== "authenticated" && state !== "signed-out" && state !== "unavailable" || !isRecord(login)) throw new Error("Kiro authentication returned an invalid response.");
			const loginState = login.state;
			if (loginState !== "idle" && loginState !== "waiting" && loginState !== "complete" && loginState !== "failed" && loginState !== "cancelled" && loginState !== "expired") throw new Error("Kiro authentication returned an invalid response.");
			const accountType = isRecord(value.identity) ? optionalString(value.identity.accountType) : void 0;
			const email = isRecord(value.identity) ? optionalString(value.identity.email) : void 0;
			const url = optionalString(login.url);
			const code = optionalString(login.code);
			const message = optionalString(login.message);
			const identity = accountType === void 0 && email === void 0 ? void 0 : {
				...accountType === void 0 ? {} : { accountType },
				...email === void 0 ? {} : { email }
			};
			return {
				state,
				...identity === void 0 ? {} : { identity },
				login: {
					state: loginState,
					...typeof login.startedAt === "number" ? { startedAt: login.startedAt } : {},
					...url === void 0 ? {} : { url },
					...code === void 0 ? {} : { code },
					...message === void 0 ? {} : { message }
				}
			};
		}
		async function call(rpc, endpoint, signal) {
			const result = await rpc.call("/kiro-auth", endpoint, {}, signal);
			if (!result.ok) throw new Error(result.error?.message ?? "Kiro authentication request failed.");
			return statusValue(result.value);
		}
		/** Bind the settings card to the plugin's loopback-only authentication channel. */
		function createKiroAuthenticationClient(rpc) {
			return {
				status: (signal) => call(rpc, "status", signal),
				startEnterpriseLogin: (signal) => call(rpc, "enterprise-login", signal),
				cancelLogin: (signal) => call(rpc, "cancel-login", signal)
			};
		}
		//#endregion
		//#region src/client/locales.ts
		const en = {
			title: "Kiro ACP",
			description: "Local Kiro CLI connection and reasoning defaults.",
			loading: "Reading Kiro ACP settings…",
			unsaved: "Unsaved",
			command: "Kiro CLI command",
			commandHint: "Executable name or absolute path. The default is kiro-cli.",
			cwd: "ACP workspace",
			cwdHint: "Leave blank to use the current DSH session workspace; set a path to override it.",
			apiKeyEnv: "API key environment variable",
			apiKeyEnvHint: "Only the variable name is stored. Its value remains in the DSH process environment.",
			defaultEffort: "Default reasoning effort",
			defaultEffortHint: "A conversation-level choice overrides this default.",
			authTitle: "Kiro account",
			authBody: "Enterprise sign-in uses Kiro CLI device code. DSH never reads or stores the resulting credentials.",
			authLoading: "Checking Kiro sign-in…",
			authConnected: "Signed in to Kiro.",
			authSignedOut: "Not signed in to Kiro.",
			authUnavailable: "Kiro CLI could not be checked from this DSH host.",
			authLocalOnly: "For security, enterprise sign-in is available only from the DSH host’s local web page. Run kiro-cli login --use-device-flow --license pro on the host instead.",
			authEnterpriseLogin: "Sign in with enterprise SSO",
			authRelogin: "Sign in again",
			authCancel: "Cancel sign-in",
			authRefresh: "Refresh status",
			authSaveFirst: "Save the edited CLI settings before starting sign-in.",
			authWaiting: "Waiting for browser authorization…",
			authPreparing: "Preparing a one-time device code…",
			authComplete: "Sign-in finished; refreshing Kiro account status…",
			authFailed: "Kiro CLI ended before sign-in completed.",
			authCancelled: "Sign-in was cancelled.",
			authExpired: "Sign-in timed out. Start again to receive a new code.",
			authDeviceHint: "Open the authorization page, enter the displayed code, and finish your organization’s sign-in.",
			authOpenBrowser: "Open authorization page",
			authRequestFailed: "The sign-in request could not be completed. Check that DSH Web is running locally and try again.",
			kiroDefault: "Kiro default",
			overridden: "Overridden",
			reset: "Reset",
			readOnly: "This settings document is read-only.",
			cacheTitle: "Model catalog",
			cacheBody: "The Kiro model list is cached for five minutes to keep the model selector responsive.",
			quotaTitle: "Kiro quota",
			quotaBody: "Kiro CLI and ACP do not expose a machine-readable remaining-credit value. In Kiro CLI, use /usage to open the current usage and subscription view.",
			quotaLink: "Kiro subscription help",
			discard: "Discard",
			save: "Save",
			saving: "Saving…",
			saveFailed: "The settings could not be saved. Keep the draft and try again.",
			required: "This field cannot be empty.",
			expand: "Expand",
			collapse: "Collapse"
		};
		const zh = {
			title: "Kiro ACP",
			description: "本机 Kiro CLI 连接与推理默认值。",
			loading: "正在读取 Kiro ACP 配置…",
			unsaved: "未保存",
			command: "Kiro CLI 命令",
			commandHint: "可执行文件名或绝对路径；默认值为 kiro-cli。",
			cwd: "ACP 工作目录",
			cwdHint: "留空时使用当前 DSH 对话的项目目录；填写路径则固定覆盖。",
			apiKeyEnv: "API Key 环境变量",
			apiKeyEnvHint: "这里只保存变量名，密钥值仍只存在于启动 DSH 的环境中。",
			defaultEffort: "默认推理强度",
			defaultEffortHint: "单个对话中手动选择的强度会覆盖此默认值。",
			authTitle: "Kiro 账户",
			authBody: "企业登录使用 Kiro CLI 设备码。DSH 不会读取或保存登录后产生的凭据。",
			authLoading: "正在检查 Kiro 登录状态…",
			authConnected: "已登录 Kiro。",
			authSignedOut: "尚未登录 Kiro。",
			authUnavailable: "无法从当前 DSH 主机检查 Kiro CLI。",
			authLocalOnly: "为保护本机认证流程，企业登录只能从 DSH 主机的本机网页执行。请改在该主机终端运行 kiro-cli login --use-device-flow --license pro。",
			authEnterpriseLogin: "企业 SSO 登录",
			authRelogin: "重新登录",
			authCancel: "取消登录",
			authRefresh: "刷新状态",
			authSaveFirst: "请先保存已修改的 CLI 配置，再开始登录。",
			authWaiting: "正在等待浏览器授权…",
			authPreparing: "正在生成一次性设备码…",
			authComplete: "登录流程已结束，正在刷新 Kiro 账户状态…",
			authFailed: "Kiro CLI 在登录完成前结束。",
			authCancelled: "已取消登录。",
			authExpired: "登录已超时，请重新开始以获取新设备码。",
			authDeviceHint: "打开授权页面，输入上方设备码，再完成公司的登录流程。",
			authOpenBrowser: "打开授权页面",
			authRequestFailed: "登录请求无法完成。请确认 DSH Web 运行在本机后重试。",
			kiroDefault: "使用 Kiro 默认值",
			overridden: "已覆盖",
			reset: "重置",
			readOnly: "当前配置文档为只读状态。",
			cacheTitle: "模型目录",
			cacheBody: "Kiro 模型列表会缓存 5 分钟，避免每次打开模型选择器都重新启动 Kiro CLI。",
			quotaTitle: "Kiro 额度",
			quotaBody: "Kiro CLI 和 ACP 没有提供可机器读取的剩余额度。请在 Kiro CLI 中输入 /usage，查看当前用量和订阅页面。",
			quotaLink: "Kiro 订阅说明",
			discard: "放弃修改",
			save: "保存",
			saving: "正在保存…",
			saveFailed: "保存配置失败。请保留当前修改后重试。",
			required: "该字段不能为空。",
			expand: "展开",
			collapse: "收起"
		};
		//#endregion
		//#region src/client/index.ts
		const NS = "settings.kiro";
		const inject = [
			"slots",
			"locale",
			"connection",
			"remote",
			"settingsScope"
		];
		/** Register the Kiro ACP card in Settings → Plugins → Plugin configuration. */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-plugin-kiro: settings copy");
			const scope = ctx.settingsScope.bind({ namespace: "kiro" });
			const t = ctx.locale.bind(NS);
			const connection = ctx.connection;
			const authentication = createKiroAuthenticationClient(connection.rpc);
			ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
				name: "settings.plugin.item",
				key: "kiro",
				locale: NS,
				inject: () => ({
					scope,
					t,
					authentication,
					canManageAuthentication: connection.isLoopback
				})
			}, KiroSettingsCard));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map