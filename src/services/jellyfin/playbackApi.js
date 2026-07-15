import { getPlaystateApi } from '@jellyfin/sdk/lib/utils/api/playstate-api';
import {
	determinePlayMethod,
	getMediaSourceDynamicRangeInfo,
	getSubtitleStreamByIndex,
	getSubtitleTranscodePolicy,
	reorderMediaSources,
	selectMediaSource,
	toInteger
} from '../../utils/playbackSelection';
import {
	buildPlaybackRequestContext,
	buildSafeSubtitleBurnInDeviceProfile,
	buildSubtitleProfiles,
	resolveFmp4HlsContainerPreference
} from './playbackProfileBuilder';
import {fetchPlaybackInfo, buildPlaystatePayload} from './playback-api/network';
import {buildPlaybackRequestDebug} from './playback-api/requestDebug';
import {appendPlaybackDiagnostic} from '../../utils/playbackDiagnostics';
import {
	formatBurnInUrlValidationMessage,
	getSubtitleBurnInDiagnosticMessage,
	validateSubtitleBurnInTranscodingUrl
} from './playback-api/subtitleBurnIn';
import {
	shouldDetachClientRenderedSubtitlePolicy,
	shouldDetachKnownBitmapSubtitleBeforeRequest
} from './playback-api/subtitlePolicy';
import {
	buildForceDolbyVisionPayload,
	buildPayloadWithoutMkvDirectPlay,
	hasDolbyVisionMediaSource,
	isForceDolbyVisionAudioOnlyTranscode,
	summarizeMediaSourceRanges,
	usesMkvContainer
} from './playback-api/dolbyVision';
import {attachPlaybackInfoMetadata, buildPlaybackDecisionSnapshot} from './playback-api/metadata';
import {createNoMediaSourceError, PlaybackNegotiationError} from './playback-api/errors';
import {
	attemptDefaultAudioFallback,
	attemptAudioTrackIntentRemap,
	attemptDirectAudioCompatibilityProbe,
	attemptDolbyVisionMkvCompatibilityRetry
} from './playback-api/sourceNegotiation';
import {getDynamicRangeDisplayLabel} from '../../utils/playbackDynamicRange';
import {getRuntimePlatformCapabilities} from '../../utils/platformCapabilities';
import {resolveSubtitleTrackIndex} from '../../utils/trackMatching';

const DYNAMIC_RANGE_PRIORITY = {
	DV: 4,
	HDR10_PLUS: 3,
	HDR10: 2,
	HLG: 2,
	SDR: 1
};
const HDR_DYNAMIC_RANGE_IDS = new Set(['DV', 'HDR10', 'HDR10_PLUS', 'HLG']);

const getDynamicRangePriority = (mediaSource) => {
	const rangeId = getMediaSourceDynamicRangeInfo(mediaSource)?.id || 'SDR';
	return DYNAMIC_RANGE_PRIORITY[rangeId] || 0;
};

const selectPreferredSourceFromPlaybackInfo = (data, createSourceSelectionOptions) => {
	if (!data?.MediaSources?.length) {
		return {data, selectedSource: null, selection: {index: -1, reason: 'none'}};
	}
	const selection = selectMediaSource(data.MediaSources, createSourceSelectionOptions());
	if (selection.index > 0) {
		data.MediaSources = reorderMediaSources(data.MediaSources, selection.index);
	}
	return {
		data,
		selectedSource: data.MediaSources[0] || null,
		selection
	};
};

export const getItemPlaybackInfo = async (service, itemId, options = {}) => {
	try {
		const collectDiagnostics = options.enableDiagnostics === true;
		const {
			payload,
			forceTranscoding,
			disableDirectPlay,
			enableTranscoding,
			requestedAudioStreamIndex: initialRequestedAudioStreamIndex,
			forceSubtitleBurnIn,
			confirmedBitmapBurnIn,
			subtitleFallbackConsent,
			smartSubtitleTranscoding,
			assSubtitleRenderer,
			bitmapSubtitleRenderer,
			enableSubtitleBurnIn,
			allowSubtitleBurnInOnHdr,
			subtitleBurnInTextCodecs,
			dynamicRangeCap
		} = buildPlaybackRequestContext(options);
		let requestedAudioStreamIndex = initialRequestedAudioStreamIndex;
		let activePayload = payload;
		let safeSubtitleBurnInProfileApplied = forceSubtitleBurnIn === true;
		const initialRequestedSubtitleStreamIndex = toInteger(payload.SubtitleStreamIndex);
		let clientRenderedSubtitleStreamIndex = null;
		let preDetachedSubtitleStream = null;
		const runtimePlaybackCapabilities = getRuntimePlatformCapabilities()?.playback || {};
		const forceDolbyVision = options.forceDolbyVision === true;
		if (forceDolbyVision && runtimePlaybackCapabilities.supportsDolbyVision !== true) {
			throw new Error('Force DV is enabled, but this TV does not report Dolby Vision support.');
		}
		const avoidDolbyVision = !forceDolbyVision && options.avoidDolbyVision === true;
		const {
			enableFmp4HlsContainerPreference,
			forceFmp4HlsContainerPreference: forceFmp4HlsContainerPreferenceRequested
		} = resolveFmp4HlsContainerPreference(options);
		const forceFmp4HlsContainerPreference =
			forceFmp4HlsContainerPreferenceRequested === true &&
			enableFmp4HlsContainerPreference === true;
		const canUseFmp4HlsContainerPreference =
			!forceTranscoding &&
			runtimePlaybackCapabilities.supportsDolbyVision === true &&
			!forceDolbyVision &&
			(enableFmp4HlsContainerPreference || forceFmp4HlsContainerPreference);
		const preferDolbyVision =
			runtimePlaybackCapabilities.supportsDolbyVision === true &&
			(
				forceDolbyVision ||
				(!avoidDolbyVision && !forceTranscoding && dynamicRangeCap === 'auto')
			);
		const createSourceSelectionOptions = ({
			preferredMediaSourceId = options.mediaSourceId,
			sourceForceTranscoding = forceTranscoding
		} = {}) => ({
			preferredMediaSourceId,
			forceTranscoding: sourceForceTranscoding,
			dynamicRangeCap,
			preferDolbyVision,
			avoidDolbyVision
		});
		const adjustments = [];
		const diagnostics = [];
		const addDiagnostic = collectDiagnostics
			? (entry) => appendPlaybackDiagnostic(diagnostics, entry)
			: () => diagnostics;

		const knownBitmapSubtitle = shouldDetachKnownBitmapSubtitleBeforeRequest({
			options,
			subtitleStreamIndex: initialRequestedSubtitleStreamIndex,
			smartSubtitleTranscoding,
			forceSubtitleBurnIn,
			confirmedBitmapBurnIn
		});
		if (knownBitmapSubtitle && initialRequestedSubtitleStreamIndex !== null && initialRequestedSubtitleStreamIndex >= 0) {
			activePayload = {
				...activePayload,
				SubtitleStreamIndex: -1
			};
			delete activePayload.SubtitleMethod;
			clientRenderedSubtitleStreamIndex = initialRequestedSubtitleStreamIndex;
			preDetachedSubtitleStream = knownBitmapSubtitle.stream;
			addDiagnostic({
				scope: 'subtitle-policy',
				stage: 'client-render-pre-detach',
				status: 'applied',
				reason: 'known-bitmap-subtitle',
				message: 'Known bitmap subtitle was detached before PlaybackInfo and preserved for client rendering.'
			});
		}

		let data = await fetchPlaybackInfo(service, itemId, activePayload);

		if (!data?.MediaSources?.length) {
			addDiagnostic({
				scope: 'playback-info',
				stage: 'initial-request',
				status: 'empty',
				reason: 'no-media-sources',
				message: 'PlaybackInfo returned no media sources.'
			});
			if (forceDolbyVision) {
				throw new Error('Force DV is enabled, but no Dolby Vision media source was returned.');
			}
			throw createNoMediaSourceError({
				forceSubtitleBurnIn,
				diagnostics,
				subtitleStreamIndex: initialRequestedSubtitleStreamIndex
			});
		}
		addDiagnostic({
			scope: 'playback-info',
			stage: 'initial-request',
			status: 'ok',
			reason: 'media-sources-returned',
			message: `PlaybackInfo returned ${data.MediaSources.length} source(s).`
		});
		if (forceDolbyVision && !hasDolbyVisionMediaSource(data.MediaSources)) {
			const forcedDolbyVisionPayload = buildForceDolbyVisionPayload(activePayload);
			if (forcedDolbyVisionPayload) {
				const forcedDolbyVisionData = await fetchPlaybackInfo(service, itemId, forcedDolbyVisionPayload);
				if (forcedDolbyVisionData?.MediaSources?.length) {
					data = forcedDolbyVisionData;
					activePayload = forcedDolbyVisionPayload;
					adjustments.push({
						type: 'forceDolbyVisionProbe',
						toast: 'Force DV: requesting Dolby Vision-only sources.'
					});
					addDiagnostic({
						scope: 'playback-probe',
						stage: 'force-dolby-vision',
						status: 'applied',
						reason: 'dv-only-sources-returned',
						message: 'Force DV probe returned Dolby Vision-only playback sources.'
					});
				} else {
					addDiagnostic({
						scope: 'playback-probe',
						stage: 'force-dolby-vision',
						status: 'no-match',
						reason: 'empty-playback-info',
						message: 'Force DV probe returned no usable playback sources.'
					});
				}
			} else {
				addDiagnostic({
					scope: 'playback-probe',
					stage: 'force-dolby-vision',
					status: 'skipped',
					reason: 'payload-unavailable',
					message: 'Could not build Force DV probe payload.'
				});
			}
		}
		if (forceDolbyVision && !hasDolbyVisionMediaSource(data.MediaSources)) {
			const availableRanges = summarizeMediaSourceRanges(data.MediaSources);
			throw new Error(`Force DV is enabled, but Jellyfin returned no Dolby Vision source. Available: ${availableRanges}`);
		}

		let {selection: sourceSelection, selectedSource} = selectPreferredSourceFromPlaybackInfo(
			data,
			createSourceSelectionOptions
		);
		if (sourceSelection.index > 0) {
			adjustments.push({
				type: 'sourceSelection',
				toast: 'Playback source optimized for this TV.'
			});
			addDiagnostic({
				scope: 'source-selection',
				stage: 'preferred-source',
				status: 'applied',
				reason: sourceSelection.reason || 'source-reordered',
				message: 'Preferred source selection reordered PlaybackInfo media sources.'
			});
		}
		if (sourceSelection.reason === 'avoidDolbyVision') {
			adjustments.push({
				type: 'dolbyVisionFallbackSource',
				toast: 'Dolby Vision fallback: using a non-DV source.'
			});
			addDiagnostic({
				scope: 'source-selection',
				stage: 'dynamic-range-fallback',
				status: 'applied',
				reason: 'avoid-dolby-vision',
				message: 'Selected a non-Dolby Vision source for fallback.'
			});
		}

		const audioIntentResult = await attemptAudioTrackIntentRemap({
			service,
			itemId,
			activePayload,
			selectedSource,
			audioTrackIntent: options.audioTrackIntent,
			createSourceSelectionOptions,
			diagnostics: collectDiagnostics ? diagnostics : null
		});
		if (audioIntentResult) {
			data = audioIntentResult.data || data;
			selectedSource = audioIntentResult.selectedSource || selectedSource;
			activePayload = audioIntentResult.activePayload || activePayload;
			requestedAudioStreamIndex = audioIntentResult.requestedAudioStreamIndex;
		}

		const directAudioProbeResult = await attemptDirectAudioCompatibilityProbe({
			service,
			itemId,
			activePayload,
			selectedSource,
			options,
			forceTranscoding,
			forceDolbyVision,
			requestedAudioStreamIndex,
			createSourceSelectionOptions,
			diagnostics: collectDiagnostics ? diagnostics : null
		});
		if (directAudioProbeResult) {
			data = directAudioProbeResult.data;
			selectedSource = directAudioProbeResult.selectedSource;
			activePayload = directAudioProbeResult.activePayload;
			requestedAudioStreamIndex = directAudioProbeResult.requestedAudioStreamIndex;
			adjustments.push(directAudioProbeResult.adjustment);
		}

		if (canUseFmp4HlsContainerPreference && selectedSource) {
			const baseSource = selectedSource;
			const baseRangeId = getMediaSourceDynamicRangeInfo(baseSource)?.id || 'SDR';
			const basePriority = getDynamicRangePriority(baseSource);
			const shouldSkipHdrSourcePreference =
				forceFmp4HlsContainerPreference !== true &&
				HDR_DYNAMIC_RANGE_IDS.has(baseRangeId);
			if (shouldSkipHdrSourcePreference) {
				adjustments.push({
					type: 'fmp4HlsPreferenceSkippedHdr',
					toast: 'Enable fMP4-HLS container preference: skipped for HDR/DV source.'
				});
				addDiagnostic({
					scope: 'playback-probe',
					stage: 'fmp4-hls-preference',
					status: 'skipped',
					reason: 'hdr-dv-preserve-range',
					message: 'fMP4-HLS preference was skipped to preserve HDR/DV.'
				});
			} else {
				const mp4PreferredPayload = buildPayloadWithoutMkvDirectPlay(
					activePayload,
					selectedSource?.Id || options.mediaSourceId || null
				);
				if (!mp4PreferredPayload) {
					addDiagnostic({
						scope: 'playback-probe',
						stage: 'fmp4-hls-preference',
						status: 'skipped',
						reason: 'payload-unavailable',
						message: 'Could not build fMP4-HLS preference payload.'
					});
				} else {
					adjustments.push({
						type: 'dolbyVisionMp4Preference',
						toast:
							forceFmp4HlsContainerPreference === true
								? 'Force fMP4-HLS container preference: probing non-MKV direct play sources.'
								: 'Enable fMP4-HLS container preference: probing non-MKV direct play sources.'
					});
					try {
						const mp4PreferredData = await fetchPlaybackInfo(service, itemId, mp4PreferredPayload);
						const {
							data: selectedMp4Data,
							selectedSource: selectedMp4Source
						} = selectPreferredSourceFromPlaybackInfo(mp4PreferredData, createSourceSelectionOptions);
						if (selectedMp4Source) {
							const mp4RangeId = getMediaSourceDynamicRangeInfo(selectedMp4Source)?.id || 'SDR';
							const mp4Priority = getDynamicRangePriority(selectedMp4Source);
							const isNonMkvMp4Source = !usesMkvContainer(selectedMp4Source);
							const doesNotRegressDynamicRange = mp4Priority >= basePriority;
							const forcedDynamicRangeRegression =
								isNonMkvMp4Source &&
								!doesNotRegressDynamicRange &&
								forceFmp4HlsContainerPreference === true;
							if (isNonMkvMp4Source && (doesNotRegressDynamicRange || forcedDynamicRangeRegression)) {
								data = selectedMp4Data;
								selectedSource = selectedMp4Source;
								activePayload = mp4PreferredPayload;
								sourceSelection = selectMediaSource(data.MediaSources, createSourceSelectionOptions());
								adjustments.push({
									type: 'dolbyVisionMp4Applied',
									toast: forcedDynamicRangeRegression
										? 'Force fMP4-HLS container preference: selected non-MKV source with lower dynamic range.'
										: mp4RangeId === 'DV'
										? (
											forceFmp4HlsContainerPreference === true
												? 'Force fMP4-HLS container preference: selected Dolby Vision non-MKV source.'
												: 'Enable fMP4-HLS container preference: selected Dolby Vision non-MKV source.'
										)
										: (
											forceFmp4HlsContainerPreference === true
												? 'Force fMP4-HLS container preference: selected non-MKV source.'
												: 'Enable fMP4-HLS container preference: selected non-MKV source.'
										)
								});
								addDiagnostic({
									scope: 'playback-probe',
									stage: 'fmp4-hls-preference',
									status: 'applied',
									reason: forcedDynamicRangeRegression
										? 'forced-dynamic-range-regression'
										: 'non-mkv-source-selected',
									message: forcedDynamicRangeRegression
										? 'Force fMP4-HLS preference accepted a non-MKV source with lower dynamic range.'
										: 'fMP4-HLS preference selected a non-MKV source without dynamic range regression.'
								});
							} else if (usesMkvContainer(selectedMp4Source)) {
								adjustments.push({
									type: 'dolbyVisionMp4Unavailable',
									toast:
										forceFmp4HlsContainerPreference === true
											? 'Force fMP4-HLS container preference: server still selected an MKV source.'
											: 'Enable fMP4-HLS container preference: server still selected an MKV source.'
								});
								addDiagnostic({
									scope: 'playback-probe',
									stage: 'fmp4-hls-preference',
									status: 'no-match',
									reason: 'server-selected-mkv',
									message: 'fMP4-HLS preference probe still selected an MKV source.'
								});
							} else {
								adjustments.push({
									type: 'dolbyVisionMp4PreserveRange',
									toast:
										forceFmp4HlsContainerPreference === true
											? 'Force fMP4-HLS container preference: kept default source to preserve dynamic range.'
											: 'Enable fMP4-HLS container preference: kept default source to preserve dynamic range.'
								});
								addDiagnostic({
									scope: 'playback-probe',
									stage: 'fmp4-hls-preference',
									status: 'no-match',
									reason: 'dynamic-range-regression',
									message: 'fMP4-HLS preference probe was ignored to preserve dynamic range.'
								});
							}
						} else {
							adjustments.push({
								type: 'dolbyVisionMp4PreferenceFallback',
								toast:
									forceFmp4HlsContainerPreference === true
										? 'Force fMP4-HLS container preference: default profile fallback.'
										: 'Enable fMP4-HLS container preference: default profile fallback.'
							});
							addDiagnostic({
								scope: 'playback-probe',
								stage: 'fmp4-hls-preference',
								status: 'no-match',
								reason: 'empty-playback-info',
								message: 'fMP4-HLS preference probe returned no usable media source.'
							});
						}
					} catch (mp4ProbeError) {
						console.warn('fMP4-HLS container preference probe failed:', mp4ProbeError);
						adjustments.push({
							type: 'dolbyVisionMp4PreferenceFallback',
							toast:
								forceFmp4HlsContainerPreference === true
									? 'Force fMP4-HLS container preference: default profile fallback.'
									: 'Enable fMP4-HLS container preference: default profile fallback.'
						});
						addDiagnostic({
							scope: 'playback-probe',
							stage: 'fmp4-hls-preference',
							status: 'failed',
							reason: 'request-failed',
							message: mp4ProbeError?.message || 'fMP4-HLS preference probe failed.'
						});
					}
				}
			}
		}

		const dvMkvRetryResult = await attemptDolbyVisionMkvCompatibilityRetry({
			service,
			itemId,
			activePayload,
			selectedSource,
			forceTranscoding,
			enableTranscoding,
			runtimeSupportsDolbyVision: runtimePlaybackCapabilities.supportsDolbyVision,
			createSourceSelectionOptions,
			buildPayloadWithoutMkvDirectPlay,
			diagnostics: collectDiagnostics ? diagnostics : null
		});
		if (dvMkvRetryResult) {
			data = dvMkvRetryResult.data;
			selectedSource = dvMkvRetryResult.selectedSource;
			activePayload = dvMkvRetryResult.activePayload;
			adjustments.push(dvMkvRetryResult.adjustment);
		}

		const defaultAudioFallbackResult = await attemptDefaultAudioFallback({
			service,
			itemId,
			activePayload,
			selectedSource,
			options,
			forceTranscoding,
			createSourceSelectionOptions,
			diagnostics: collectDiagnostics ? diagnostics : null
		});
		if (defaultAudioFallbackResult) {
			data = defaultAudioFallbackResult.data;
			selectedSource = defaultAudioFallbackResult.selectedSource;
			activePayload = defaultAudioFallbackResult.activePayload;
			requestedAudioStreamIndex = defaultAudioFallbackResult.requestedAudioStreamIndex;
			adjustments.push(defaultAudioFallbackResult.adjustment);
		}
		if (forceDolbyVision && getMediaSourceDynamicRangeInfo(selectedSource)?.id !== 'DV') {
			const availableRanges = summarizeMediaSourceRanges(data.MediaSources);
			throw new Error(`Force DV is enabled, but selected source is not Dolby Vision. Available: ${availableRanges}`);
		}

		const originalDynamicRangeInfo = getMediaSourceDynamicRangeInfo(selectedSource);
		const subtitleStreams = Array.isArray(selectedSource?.MediaStreams) ? selectedSource.MediaStreams.filter((stream) => stream?.Type === 'Subtitle') : [];
		const subtitleIntentMatch = resolveSubtitleTrackIndex({
			subtitleStreams,
			intent: options.subtitleTrackIntent,
			fallbackIndex: initialRequestedSubtitleStreamIndex
		});
		const hasExplicitSubtitleIntent = subtitleIntentMatch.method !== 'no-intent';
		if (hasExplicitSubtitleIntent) {
			addDiagnostic({
				scope: 'subtitle-policy',
				stage: 'subtitle-intent-remap',
				status: subtitleIntentMatch.index === null ? 'no-match' : 'applied',
				reason: subtitleIntentMatch.method,
				message: subtitleIntentMatch.index === -1
					? 'Subtitle intent resolved to subtitles off.'
					: `Subtitle intent resolved to stream ${subtitleIntentMatch.index}.`
			});
		}
		let selectedSubtitleStreamIndex =
			clientRenderedSubtitleStreamIndex ??
			(subtitleIntentMatch.method !== 'no-intent' ? subtitleIntentMatch.index : initialRequestedSubtitleStreamIndex) ??
			toInteger(activePayload.SubtitleStreamIndex ?? payload.SubtitleStreamIndex);
		if (!hasExplicitSubtitleIntent && (selectedSubtitleStreamIndex === null || selectedSubtitleStreamIndex < 0)) {
			const defaultSubtitleStreamIndex = toInteger(selectedSource?.DefaultSubtitleStreamIndex);
			const defaultSubtitlePolicy = defaultSubtitleStreamIndex !== null && defaultSubtitleStreamIndex >= 0
				? getSubtitleTranscodePolicy(selectedSource, defaultSubtitleStreamIndex, {
					smartSubtitleTranscoding,
					assSubtitleRenderer,
					bitmapSubtitleRenderer,
					enableSubtitleBurnIn,
					forceSubtitleBurnIn,
					confirmedBitmapBurnIn,
					allowSubtitleBurnInOnHdr,
					subtitleBurnInTextCodecs,
					originalDynamicRangeInfo
				})
				: null;
			const preliminaryPlayMethod = determinePlayMethod(selectedSource, {
				forceTranscoding,
				disableDirectPlay,
				dynamicRangeCap
			});
			const shouldDetachDefaultBitmapSubtitle =
				preliminaryPlayMethod === 'Transcode' &&
				defaultSubtitlePolicy?.clientRender === true &&
				String(defaultSubtitlePolicy?.renderer || '').startsWith('client-bitmap') &&
				activePayload.SubtitleStreamIndex !== -1;
			if (shouldDetachDefaultBitmapSubtitle) {
				const detachedDefaultPayload = {
					...activePayload,
					SubtitleStreamIndex: -1
				};
				delete detachedDefaultPayload.SubtitleMethod;
				const detachedDefaultData = await fetchPlaybackInfo(service, itemId, detachedDefaultPayload);
				if (detachedDefaultData?.MediaSources?.length) {
					data = detachedDefaultData;
					const detachedDefaultSelection = selectMediaSource(
						data.MediaSources,
						createSourceSelectionOptions({
							preferredMediaSourceId: selectedSource?.Id,
							sourceForceTranscoding: forceTranscoding
						})
					);
					if (detachedDefaultSelection.index > 0) {
						data.MediaSources = reorderMediaSources(data.MediaSources, detachedDefaultSelection.index);
					}
					selectedSource = data.MediaSources[0];
					activePayload = detachedDefaultPayload;
					selectedSubtitleStreamIndex = defaultSubtitleStreamIndex;
					clientRenderedSubtitleStreamIndex = defaultSubtitleStreamIndex;
					addDiagnostic({
						scope: 'subtitle-policy',
						stage: 'default-bitmap-detach',
						status: 'applied',
						reason: defaultSubtitlePolicy.reason || 'default-bitmap-subtitle',
						message: 'Server-selected bitmap subtitle was detached from transcode and preserved for client rendering.'
					});
				} else {
					addDiagnostic({
						scope: 'subtitle-policy',
						stage: 'default-bitmap-detach',
						status: 'failed',
						reason: 'empty-playback-info',
						message: 'Could not detach server-selected bitmap subtitle from the transcode request.'
					});
				}
			}
		}
		let subtitlePolicy = getSubtitleTranscodePolicy(selectedSource, selectedSubtitleStreamIndex, {
			smartSubtitleTranscoding,
			assSubtitleRenderer,
			bitmapSubtitleRenderer,
			enableSubtitleBurnIn,
			forceSubtitleBurnIn,
			confirmedBitmapBurnIn,
			allowSubtitleBurnInOnHdr,
			subtitleBurnInTextCodecs,
			originalDynamicRangeInfo
		});
		if (
			shouldDetachClientRenderedSubtitlePolicy(subtitlePolicy) &&
			selectedSubtitleStreamIndex !== null &&
			selectedSubtitleStreamIndex >= 0 &&
			activePayload.SubtitleStreamIndex !== -1
		) {
			const detachedSubtitlePayload = {
				...activePayload,
				SubtitleStreamIndex: -1
			};
			delete detachedSubtitlePayload.SubtitleMethod;
			const detachedSubtitleData = await fetchPlaybackInfo(service, itemId, detachedSubtitlePayload);
			if (detachedSubtitleData?.MediaSources?.length) {
				data = detachedSubtitleData;
				const detachedSelection = selectMediaSource(
					data.MediaSources,
					createSourceSelectionOptions({
						preferredMediaSourceId: selectedSource?.Id,
						sourceForceTranscoding: forceTranscoding
					})
				);
				if (detachedSelection.index > 0) {
					data.MediaSources = reorderMediaSources(data.MediaSources, detachedSelection.index);
				}
				selectedSource = data.MediaSources[0];
				activePayload = detachedSubtitlePayload;
				subtitlePolicy = getSubtitleTranscodePolicy(selectedSource, selectedSubtitleStreamIndex, {
					smartSubtitleTranscoding,
					assSubtitleRenderer,
					bitmapSubtitleRenderer,
					enableSubtitleBurnIn,
					forceSubtitleBurnIn,
					confirmedBitmapBurnIn,
					allowSubtitleBurnInOnHdr,
					subtitleBurnInTextCodecs,
					originalDynamicRangeInfo
				});
				clientRenderedSubtitleStreamIndex = selectedSubtitleStreamIndex;
				addDiagnostic({
					scope: 'subtitle-policy',
					stage: 'client-render-detach',
					status: 'applied',
					reason: subtitlePolicy.reason || 'client-render-subtitle',
					message: 'PlaybackInfo was re-requested without server subtitle delivery for client-side rendering.'
				});
			} else {
				addDiagnostic({
					scope: 'subtitle-policy',
					stage: 'client-render-detach',
					status: 'failed',
					reason: 'empty-playback-info',
					message: 'Could not detach client-rendered subtitle from the server playback request.'
				});
			}
		}
		const subtitleNeedsTranscoding = subtitlePolicy.requiresBurnIn === true;
		const effectiveForceSubtitleBurnIn = forceSubtitleBurnIn || subtitleNeedsTranscoding;
		let playMethod = determinePlayMethod(selectedSource, {
			forceTranscoding: forceTranscoding || effectiveForceSubtitleBurnIn,
			disableDirectPlay,
			dynamicRangeCap
		});
		if (forceDolbyVision && playMethod === 'Transcode') {
			if (isForceDolbyVisionAudioOnlyTranscode(selectedSource)) {
				adjustments.push({
					type: 'forceDolbyVisionAudioOnlyTranscode',
					toast: 'Force DV: allowing audio-only transcoding path.'
				});
			} else {
				const availableRanges = summarizeMediaSourceRanges(data.MediaSources);
				throw new Error(
					`Force DV requires direct playback or audio-only transcode, but Jellyfin selected incompatible transcoding. Available: ${availableRanges}`
				);
			}
		}
		if (subtitleNeedsTranscoding) {
			adjustments.push({
				type: 'subtitleTranscodeGuard',
				toast: 'Using transcoding for subtitle compatibility.'
			});
			addDiagnostic({
				scope: 'subtitle-policy',
				stage: 'burn-in-decision',
				status: 'applied',
				reason: subtitlePolicy.reason || 'requires-burn-in',
				message: getSubtitleBurnInDiagnosticMessage(subtitlePolicy)
			});
		} else if (selectedSubtitleStreamIndex !== null && selectedSubtitleStreamIndex >= 0) {
			addDiagnostic({
				scope: 'subtitle-policy',
				stage: 'burn-in-decision',
				status: 'skipped',
				reason: subtitlePolicy.reason || 'burn-in-not-required',
				message: getSubtitleBurnInDiagnosticMessage(subtitlePolicy)
			});
		}
		let burnInUrlValidated = false;
		let burnInUrlValid = !effectiveForceSubtitleBurnIn;
		const shouldUseSafeSubtitleBurnInProfile = effectiveForceSubtitleBurnIn === true;
		if (
			playMethod === 'Transcode' &&
			enableTranscoding &&
			(!selectedSource?.TranscodingUrl || (shouldUseSafeSubtitleBurnInProfile && !safeSubtitleBurnInProfileApplied))
		) {
			const transcodePayload = {
				...activePayload,
				EnableDirectPlay: false,
				EnableDirectStream: false,
				EnableTranscoding: true
			};
			delete transcodePayload.SubtitleMethod;
			if (shouldUseSafeSubtitleBurnInProfile) {
				transcodePayload.AllowVideoStreamCopy = false;
				transcodePayload.AllowAudioStreamCopy = false;
			}
			if (selectedSource?.Id) {
				transcodePayload.MediaSourceId = selectedSource.Id;
			}
			if (Number.isInteger(requestedAudioStreamIndex)) {
				transcodePayload.AudioStreamIndex = requestedAudioStreamIndex;
			}
			if (selectedSubtitleStreamIndex !== null && selectedSubtitleStreamIndex >= 0) {
				transcodePayload.SubtitleStreamIndex = selectedSubtitleStreamIndex;
				if (effectiveForceSubtitleBurnIn) {
					transcodePayload.AlwaysBurnInSubtitleWhenTranscoding = true;
					if (transcodePayload.DeviceProfile) {
						transcodePayload.DeviceProfile = shouldUseSafeSubtitleBurnInProfile
							? buildSafeSubtitleBurnInDeviceProfile(transcodePayload.DeviceProfile)
							: {
								...transcodePayload.DeviceProfile,
								SubtitleProfiles: buildSubtitleProfiles({
									relaxedPlaybackProfile: false,
									forceSubtitleBurnIn: true
								})
							};
					}
				} else {
					delete transcodePayload.SubtitleMethod;
				}
			}
			if (shouldUseSafeSubtitleBurnInProfile) {
				addDiagnostic({
					scope: 'subtitle-policy',
					stage: 'burn-in-safe-profile',
					status: 'applied',
					reason: 'subtitle-burn-in-safe-transcode',
					message: 'Requesting subtitle burn-in with HLS TS, H.264 video, AAC audio, and a 6-channel audio cap.'
				});
			}
			const transcodedData = await fetchPlaybackInfo(service, itemId, transcodePayload);
			if (transcodedData?.MediaSources?.length) {
				data = transcodedData;
				const transcodeSelection = selectMediaSource(
					data.MediaSources,
					createSourceSelectionOptions({
						preferredMediaSourceId: selectedSource?.Id,
						sourceForceTranscoding: true
					})
				);
				if (transcodeSelection.index > 0) {
					data.MediaSources = reorderMediaSources(data.MediaSources, transcodeSelection.index);
				}
				selectedSource = data.MediaSources[0];
				playMethod = 'Transcode';
				activePayload = transcodePayload;
				safeSubtitleBurnInProfileApplied = shouldUseSafeSubtitleBurnInProfile;
				if (effectiveForceSubtitleBurnIn) {
					const burnInUrlValidation = validateSubtitleBurnInTranscodingUrl(
						selectedSource,
						selectedSubtitleStreamIndex
					);
					addDiagnostic({
						scope: 'subtitle-policy',
						stage: 'burn-in-url-validation',
						status: burnInUrlValidation.ok ? 'applied' : 'failed',
						reason: burnInUrlValidation.ok ? 'subtitle-encode-url' : 'subtitle-encode-url-missing',
						message: formatBurnInUrlValidationMessage(burnInUrlValidation)
					});
					burnInUrlValidated = true;
					burnInUrlValid = burnInUrlValidation.ok;
				}
				subtitlePolicy = getSubtitleTranscodePolicy(selectedSource, selectedSubtitleStreamIndex, {
					smartSubtitleTranscoding,
					assSubtitleRenderer,
					bitmapSubtitleRenderer,
					enableSubtitleBurnIn,
					forceSubtitleBurnIn,
					confirmedBitmapBurnIn,
					allowSubtitleBurnInOnHdr,
					subtitleBurnInTextCodecs,
					originalDynamicRangeInfo
				});
				adjustments.push({
					type: 'forcedTranscode',
					toast: 'Using transcoding for compatibility.'
				});
				addDiagnostic({
					scope: 'playback-probe',
					stage: 'forced-transcode',
					status: 'applied',
					reason: effectiveForceSubtitleBurnIn ? 'subtitle-burn-in' : 'play-method-transcode',
					message: 'PlaybackInfo was re-requested with transcoding enabled.'
				});
			} else {
				addDiagnostic({
					scope: 'playback-probe',
					stage: 'forced-transcode',
					status: 'no-match',
					reason: 'empty-playback-info',
					message: 'Transcode PlaybackInfo request returned no media sources.'
				});
				if (effectiveForceSubtitleBurnIn) {
					throw createNoMediaSourceError({
						forceSubtitleBurnIn: true,
						diagnostics,
						subtitleStreamIndex: selectedSubtitleStreamIndex
					});
				}
			}
		}
		if (effectiveForceSubtitleBurnIn && selectedSource?.TranscodingUrl && !burnInUrlValidated) {
			const burnInUrlValidation = validateSubtitleBurnInTranscodingUrl(
				selectedSource,
				selectedSubtitleStreamIndex
			);
			addDiagnostic({
				scope: 'subtitle-policy',
				stage: 'burn-in-url-validation',
				status: burnInUrlValidation.ok ? 'applied' : 'failed',
				reason: burnInUrlValidation.ok ? 'subtitle-encode-url' : 'subtitle-encode-url-missing',
				message: formatBurnInUrlValidationMessage(burnInUrlValidation)
			});
			burnInUrlValid = burnInUrlValidation.ok;
		}
		if (effectiveForceSubtitleBurnIn && !burnInUrlValid) {
			throw createNoMediaSourceError({
				forceSubtitleBurnIn: true,
				diagnostics,
				subtitleStreamIndex: selectedSubtitleStreamIndex
			});
		}

		const dynamicRangeInfo = getMediaSourceDynamicRangeInfo(selectedSource);
		const dynamicRange = {
			...dynamicRangeInfo,
			displayLabel: getDynamicRangeDisplayLabel(dynamicRangeInfo, dynamicRangeCap)
		};
		const subtitleStream = getSubtitleStreamByIndex(selectedSource, selectedSubtitleStreamIndex) || preDetachedSubtitleStream;
		const playbackSubtitlePolicy = {
			...subtitlePolicy,
			streamIndex: selectedSubtitleStreamIndex,
			codec: subtitlePolicy.codec || subtitleStream?.Codec || null,
			requiresBurnIn: subtitleNeedsTranscoding,
			forceBurnIn: effectiveForceSubtitleBurnIn,
			clientRenderedStreamIndex: clientRenderedSubtitleStreamIndex,
			originalDynamicRangeInfo,
			originalDynamicRangeId: originalDynamicRangeInfo?.id || dynamicRange?.id || 'SDR'
		};
		const requestDebug = collectDiagnostics ? buildPlaybackRequestDebug(activePayload, data) : null;
		const decision = collectDiagnostics ? buildPlaybackDecisionSnapshot({
			activePayload,
			selectedSource,
			playMethod,
			initialRequestedAudioStreamIndex,
			requestedAudioStreamIndex,
			selectedSubtitleStreamIndex,
			clientRenderedSubtitleStreamIndex,
			dynamicRange,
			originalDynamicRange: originalDynamicRangeInfo,
			dynamicRangeCap,
			forceTranscoding,
			disableDirectPlay,
			forceDolbyVision,
			avoidDolbyVision,
			enableFmp4HlsContainerPreference,
			forceFmp4HlsContainerPreference,
			forceSubtitleBurnIn: effectiveForceSubtitleBurnIn,
			confirmedBitmapBurnIn,
			subtitleFallbackConsent,
			safeSubtitleBurnInProfile: safeSubtitleBurnInProfileApplied,
			subtitlePolicy: playbackSubtitlePolicy
		}) : null;

		return attachPlaybackInfoMetadata(data, {
			playMethod,
			selectedSource,
			selectedAudioStreamIndex: requestedAudioStreamIndex,
			adjustments,
			dynamicRange,
			dynamicRangeCap,
			subtitlePolicy: playbackSubtitlePolicy,
			requestDebug,
			diagnostics,
			decision,
			safeSubtitleBurnInProfile: safeSubtitleBurnInProfileApplied
		});
	} catch (error) {
		if (!(error instanceof PlaybackNegotiationError)) {
			console.error('Failed to get playback info:', error);
		}
		throw error;
	}
};

export const getPlaybackStreamUrl = (service, itemId, mediaSourceId, playSessionId, tag, container, liveStreamId) => {
	const params = new URLSearchParams({
		static: 'true',
		api_key: service.accessToken
	});
	if (container) {
		params.set('container', container);
	}
	if (mediaSourceId) {
		params.set('mediaSourceId', mediaSourceId);
	}
	if (playSessionId) {
		params.set('playSessionId', playSessionId);
	}
	if (tag) {
		params.set('tag', tag);
	}
	if (liveStreamId) {
		params.set('liveStreamId', liveStreamId);
	}
	const deviceId = typeof service?.getDeviceId === 'function'
		? service.getDeviceId()
		: service?.deviceId;
	if (deviceId) {
		params.set('deviceId', deviceId);
	}
	return `${service.serverUrl}/Videos/${itemId}/stream?${params.toString()}`;
};

export const getTranscodePlaybackUrl = (service, playSessionId, mediaSource) => {
	if (mediaSource.TranscodingUrl) {
		return `${service.serverUrl}${mediaSource.TranscodingUrl}`;
	}
	return null;
};

export const reportPlaybackStarted = async (service, itemId, positionTicks = 0, session = {}) => {
	const playstateApi = getPlaystateApi(service.api);
	await playstateApi.reportPlaybackStart({
		playbackStartInfo: buildPlaystatePayload({
			ItemId: itemId,
			PositionTicks: positionTicks,
			IsPaused: false,
			IsMuted: false,
			PlayMethod: 'DirectStream'
		}, session)
	});
};

export const reportPlaybackProgressState = async (service, itemId, positionTicks, isPaused = false, session = {}) => {
	const playstateApi = getPlaystateApi(service.api);
	await playstateApi.reportPlaybackProgress({
		playbackProgressInfo: buildPlaystatePayload({
			ItemId: itemId,
			PositionTicks: positionTicks,
			IsPaused: isPaused,
			IsMuted: false,
			PlayMethod: 'DirectStream'
		}, session)
	});
};

export const reportPlaybackStoppedState = async (service, itemId, positionTicks, session = {}) => {
	const playstateApi = getPlaystateApi(service.api);
	await playstateApi.reportPlaybackStopped({
		playbackStopInfo: buildPlaystatePayload({
			ItemId: itemId,
			PositionTicks: positionTicks,
			PlayMethod: 'DirectStream'
		}, session)
	});
};
