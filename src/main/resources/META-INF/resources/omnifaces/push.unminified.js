/*
 * Copyright 2015 OmniFaces.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
 * an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */
var OmniFaces = OmniFaces || {};

/**
 * Manage web socket push channels. This script is used by <code>&lt;o:socket&gt;</code>.
 * 
 * @author Bauke Scholtz
 * @see org.omnifaces.cdi.push.Socket
 * @since 2.3
 */
OmniFaces.Push = (function(Util, window) {

	// "Constant" fields ----------------------------------------------------------------------------------------------

	var WS_SUPPORTED = !!window.WebSocket;
	var URL_PROTOCOL = window.location.protocol.replace("http", "ws") + "//";
	var URI_PREFIX = "/omnifaces.push";
	var RECONNECT_INTERVAL = 500;
	var MAX_RECONNECT_INTERVAL = 10000;

	// Private static fields ------------------------------------------------------------------------------------------

	var sockets = {};
	var self = {};

	// Private constructor functions ----------------------------------------------------------------------------------

	/**
	 * Creates a reconnecting web socket.
	 * @constructor
	 * @param {string} url The URL of the web socket 
	 * @param {string} channel The name of the web socket channel.
	 * @param {function} onmessage The function to be invoked when a message is received.
	 * @param {function} onclose The function to be invoked when the web socket is closed.
	 */
	function Socket(url, channel, onmessage, onclose) {

		// Private fields -----------------------------------------------------------------------------------------

		var socket;
		var reconnectAttempts = 0;
		var self = this;

		// Public functions ---------------------------------------------------------------------------------------

		self.open = function() {
			socket = new WebSocket(url);

			socket.onopen = function(event) {
				reconnectAttempts = 0;
			}

			socket.onmessage = function(event) {
				onmessage(JSON.parse(event.data), channel, event);
			}

			socket.onclose = function(event) {
				if (!socket) {
					onclose(event.code, channel, event);
				}
				else if (event.code != 1011) { // SocketEndpoint returns 1011 on unregistered channel.
					reconnectAttempts++;
					setTimeout(function() {
						self.open();
					}, Math.min(RECONNECT_INTERVAL * reconnectAttempts, MAX_RECONNECT_INTERVAL));
				}
			}
		}

		self.close = function() {
			if (socket) {
				var s = socket;
				socket = null;
				s.close();
			}
		}

		// Init ---------------------------------------------------------------------------------------------------

		self.open();

	}
	
	// Public static functions ----------------------------------------------------------------------------------------
	
	/**
	 * Open a web socket on the given channel. It will stay open and reconnect as long as channel is valid and
	 * <code>OmniFaces.Push.close()</code> hasn't explicitly been called on the same channel.
	 * @param {string} host Required; The host of the web socket in either the format 
	 * <code>example.com:8080/context</code>, or <code>:8080/context</code>, or <code>/context</code>.
	 * If the value is falsey, then it will default to <code>window.location.host</code>.
	 * If the value starts with <code>:</code>, then <code>window.location.hostname</code> will be prepended.
	 * If the value starts with <code>/</code>, then <code>window.location.host</code> will be prepended.
	 * @param {string} channel Required; The name of the web socket channel. All open websockets on the same channel 
	 * name will receive the same push notification from the server. If you want to make the web socket private to a
	 * specific user or group of users, then best is to append an autogenerated identifier to the channel name which
	 * identifies the specific user or group of users.
	 * @param {function} onmessage Optional; The JavaScript event handler function that is invoked when a message is
	 * received from the server. The function will be invoked with three arguments: the push message, the channel name 
	 * and the raw <code>MessageEvent</code> itself.
	 * @param {function} onclose Optional; The JavaScript event handler function that is invoked when the web socket is
	 * closed. The function will be invoked with three arguments: the close reason code, the channel name and the raw 
	 * <code>CloseEvent</code> itself. Note that this will also be invoked on errors and that you can inspect the
	 * close reason code if an error occurred and which one (i.e. when the code is not 1000). See also
	 * <a href="http://tools.ietf.org/html/rfc6455#section-7.4.1">RFC 6455 section 7.4.1</a> and
	 * <a href="http://docs.oracle.com/javaee/7/api/javax/websocket/CloseReason.CloseCodes.html">CloseCodes</a> API
	 * for an elaborate list.
	 */
	self.open = function(host, channel, onmessage, onclose) {
		onclose = Util.resolveFunction(onclose);

		if (!WS_SUPPORTED) { // IE6-9.
			onclose(-1, channel);
			return;
		}

		self.close(channel); // Forcibly close any opened socket on same channel.
		var url = getBaseURL(host) + encodeURIComponent(channel);
		sockets[channel] = new Socket(url, channel, Util.resolveFunction(onmessage), onclose);
	}

	/**
	 * Close the web socket on the given channel.
	 * @param {string} channel Required; the name of the web socket channel.
	 */
	self.close = function(channel) {
		var socket = sockets[channel];

		if (socket) {
			delete sockets[channel];
			socket.close();
		}
	}

	// Private static functions ---------------------------------------------------------------------------------------

	/**
	 * Get base URL from given host.
	 * @param {string} host The host of the web socket in either the format 
	 * <code>example.com:8080/context</code>, or <code>:8080/context</code>, or <code>/context</code>.
	 * If the value is falsey, then it will default to <code>window.location.host</code>.
	 * If the value starts with <code>:</code>, then <code>window.location.hostname</code> will be prepended.
	 * If the value starts with <code>/</code>, then <code>window.location.host</code> will be prepended.
	 */
	function getBaseURL(host) {
		host = host || "";
		var base = (!host || host.indexOf("/") == 0) ? window.location.host + host
				: (host.indexOf(":") == 0) ? window.location.hostname + host
				: host;
		return URL_PROTOCOL + base + URI_PREFIX + "/";
	}

	// Expose self to public ------------------------------------------------------------------------------------------

	return self;

})(OmniFaces.Util, window);