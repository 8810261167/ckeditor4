/* bender-tags: widgetcore */
/* bender-ckeditor-plugins: wysiwygarea, toolbar, table, image2, clipboard */

( function() {
	'use strict';

	bender.editor = {
		config: {
			allowedContent: true
		}
	};

	var overlay;

	var tests = {
		// Hide editor under an overlay, to prevent accidental mouse move which might break TC.
		setUp: function() {
			if ( !overlay ) {
				overlay = new CKEDITOR.dom.element( 'div' );

				overlay.setStyles( {
					position: 'fixed',
					width: '100%',
					height: '100%',
					left: 0,
					top: 0
				} );

				CKEDITOR.document.getBody().append( overlay );
			} else {
				overlay.removeStyle( 'display' );
			}
		},
		tearDown: function() {
			overlay.setStyle( 'display', 'none' );
		}
	};

	addTests();
	addTests( true );

	bender.test( tests );

	// When dragging into table cell drag line should appear in right place, and widget should be pasted in right place.
	// Cases covered by tests:
	// 	- Cell is empty. Line should appear in the middle of cell. Widget is pasted into cell.
	// 	- Cell has text node. Line should appear at the position of of hovered temporary fake paragraph.
	// 	There are two such paragraphs, one at the start of cell and one at the end of cell. Widget should replace hovered temporary paragraph.
	// 	- Cell has inline element. Line should appear at the top or at the bottom edge of inline element depending on which edge is hovered.
	// 	Widget should be pasted before or after inline element depending on which end is hovered.
	// Additionally editable contains tables with more that 100 cells total lines will be created asynchronously when cell is hovered.
	// (#1648)
	function addTests( asyncLines ) {
		var msgStart = 'test drag into table with ' + ( asyncLines ? 'asynchronous' : 'synchronous' + 'lines creation ' );

		tests[ msgStart + 'left top cell - empty' ] = assertDragLine( 'table tr:nth-child(1) th:nth-child(1)', 'inside', asyncLines );
		tests[ msgStart + 'middle cell - empty' ] = assertDragLine( 'table tr:nth-child(1) td:nth-child(2)', 'inside', asyncLines );
		tests[ msgStart + 'right bottom cell - empty' ] = assertDragLine( 'table tr:nth-child(2) td:nth-child(3)', 'inside', asyncLines );
		tests[ msgStart + 'middle top cell - text' ] = assertDragLine( 'table tr:nth-child(1) th:nth-child(2)', 'before', asyncLines );
		tests[ msgStart + 'right middle cell - text' ] = assertDragLine( 'table tr:nth-child(1) td:nth-child(3)', 'after', asyncLines );
		tests[ msgStart + 'left bottom  cell - text' ] = assertDragLine( 'table tr:nth-child(2) td:nth-child(1)', 'before', asyncLines );
		tests[ msgStart + 'right top cell - inline element' ] = assertDragLine( 'table tr:nth-child(1) th:nth-child(3)', 'after', asyncLines );
		tests[ msgStart + 'left middle cell - inline element' ] = assertDragLine( 'table tr:nth-child(1) td:nth-child(1)', 'before', asyncLines );
		tests[ msgStart + 'middle bottom cell - inline element' ] = assertDragLine( 'table tr:nth-child(2) td:nth-child(2)', 'after', asyncLines );
	}

	function assertDragLine( selector, position, asyncLines ) {
		return function() {
			// Ignore IE8 (#3004).
			if ( CKEDITOR.env.ie && CKEDITOR.env.version < 9 ) {
				assert.ignore();
			}
			this.editorBot.setData( CKEDITOR.document.findOne( asyncLines ? '#asynchronous-lines' : '#synchronous-lines' ).getHtml(), function() {
				var editor = this.editor,
					editable = editor.editable(),
					handler = editable.findOne( '.cke_widget_drag_handler' ),
					element = editable.findOne( selector ),
					coordinates = getPoint( element.getClientRect(), 'inside' );

				// Adjust mouse position closer to the tested edge of cell.
				if ( position in { before: 1 , after: 1 } ) {
					coordinates.y += position === 'before' ? -1 : 1;
				}

				handler.once( 'mousedown', function() {
					editable.fire( 'mousemove', {
						$: {
							clientX: coordinates.x,
							clientY: coordinates.y
						},
						getTarget: function() {
							return element;
						}
					} );
				}, null, null, 9999 );

				editable.once( 'mousemove', function() {
					// Wait for event buffer which is 50ms.
					setTimeout( function() {
						resume( function() {
							if ( position in { before: 1 , after: 1 } ) {
								var referenceElement = element[ position === 'before' ? 'getFirst' : 'getLast' ]();
							}

							var elementRect = ( referenceElement || element ).getClientRect( true ),
								visible = editor.widgets.liner.visible,
								lineRect = visible[ CKEDITOR.tools.objectKeys( visible )[ 0 ] ].getClientRect( true ),
								actual = getPoint( lineRect, position ),
								expected = getPoint( elementRect, position );

							assert.isNumberInRange( Math.round( expected.x ), Math.round( actual.x - 1 ), Math.round( actual.x + 1 ), 'Line vertical position' );
							assert.isNumberInRange( Math.round( expected.y ), Math.round( actual.y - 1 ), Math.round( actual.y + 1 ), 'Line horizontal position' );

							editor.once( 'paste', function() {
								resume( function() {
									var widget = editable.findOne( 'figure' );
									assert.isTrue( element[ position === 'after' ? 'getLast' : 'getFirst' ]().contains( widget ), 'Widget in cell' );
									arrayAssert.isEmpty( editable.find( '.cke_fake-paragraph' ).toArray(), 'Temporary fake paragraphs removed.' );
								} );
							}, null, null, 999 );

							CKEDITOR.document.fire( 'mouseup', {
								button: CKEDITOR.MOUSE_BUTTON_LEFT,
								getTarget: function() {
									return element;
								}
							} );

							wait();
						} );
					}, 55 );
				}, null, null, 9999 );

				handler.fire( 'mousedown', new CKEDITOR.dom.event( {
					button: CKEDITOR.MOUSE_BUTTON_LEFT,
					target: handler
				} ) );

				wait();
			} );
		};
	}

	function getPoint( rect, position ) {
		var y;

		if ( position in { before: 1 , after: 1 } ) {
			y = position === 'before' ? rect.top : rect.bottom;
		} else {
			y = ( rect.bottom + rect.top ) / 2;
		}

		return {
			x: ( rect.right + rect.left ) / 2,
			y: y
		};
	}
} )();
