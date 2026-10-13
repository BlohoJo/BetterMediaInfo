/*
 *   Copyright (c) 2024-2026. caoccao.com Sam Cao
 *   All rights reserved.

 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at

 *   http://www.apache.org/licenses/LICENSE-2.0

 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, UIEvent } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  FormControlLabel,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import {
  GridColumnVisibilityModel,
  gridColumnDefinitionsSelector,
  gridColumnVisibilityModelSelector,
  useGridApiContext,
  useGridSelector,
} from '@mui/x-data-grid';
import { useTranslation } from 'react-i18next';

interface ListColumnsManagementContextValue {
  /** Moves a column by `offset` positions in the List view column order. */
  moveColumn: (field: string, offset: number) => void;
  /** Restores the default column order, keeping the checked columns. */
  resetOrder: () => void;
  /** Restores the default columns, the default order and the default widths. */
  resetAll: () => void;
  /** True when the column order has not been customized. */
  isDefaultOrder: boolean;
  /** True when the columns, their order and their widths are all at their defaults. */
  isDefaultAll: boolean;
}

export const ListColumnsManagementContext = createContext<ListColumnsManagementContextValue>({
  moveColumn: () => {},
  resetOrder: () => {},
  resetAll: () => {},
  isDefaultOrder: true,
  isDefaultAll: true,
});

const isVisible = (model: GridColumnVisibilityModel, field: string) => model[field] !== false;

// The panel can list well over a thousand template columns, so the rows are windowed:
// only the rows inside (and slightly around) the scrolled viewport are mounted.
const ROW_HEIGHT = 32;
const LIST_HEIGHT = 320;
const OVERSCAN = 6;

/**
 * Replacement for the DataGrid "Manage columns" panel.
 *
 * Compared to the stock panel it
 * - lists the columns in the List view display order, which keeps the checked columns at the
 *   top (default columns first, then the template columns in the order the user added them)
 *   and leaves an unchecked column exactly where it was, so it is easy to check it again;
 * - adds up/down buttons to every row to change the column order (the Community DataGrid
 *   cannot reorder columns by dragging the column headings);
 * - replaces the single "Reset" button with "Reset Order" and "Reset All";
 * - only checks "Show/Hide All" when every column is visible, and asks for confirmation
 *   before adding hundreds of columns at once;
 * - renders only the rows that are scrolled into view.
 */
export default function ListColumnsManagement() {
  const { t } = useTranslation();
  const apiRef = useGridApiContext();
  const {
    moveColumn,
    resetOrder,
    resetAll,
    isDefaultOrder,
    isDefaultAll,
  } = useContext(ListColumnsManagementContext);
  const columns = useGridSelector(apiRef, gridColumnDefinitionsSelector);
  const columnVisibilityModel = useGridSelector(apiRef, gridColumnVisibilityModelSelector);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const hideableColumns = useMemo(
    () => columns.filter((column) => column.hideable !== false),
    [columns]
  );

  const rows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return hideableColumns
      .map((column, index) => ({
        field: column.field,
        label: column.headerName ?? column.field,
        index,
      }))
      .filter((row) => keyword.length === 0 || row.label.toLowerCase().includes(keyword));
  }, [hideableColumns, search]);

  const allColumnsVisible = useMemo(
    () => hideableColumns.length > 0
      && hideableColumns.every((column) => isVisible(columnVisibilityModel, column.field)),
    [columnVisibilityModel, hideableColumns]
  );

  const setAllColumnsVisible = useCallback(
    (visible: boolean) => {
      const newModel: GridColumnVisibilityModel = { ...columnVisibilityModel };
      hideableColumns.forEach((column) => {
        newModel[column.field] = visible;
      });
      apiRef.current.setColumnVisibilityModel(newModel);
    },
    [apiRef, columnVisibilityModel, hideableColumns]
  );

  const handleToggleAll = useCallback(() => {
    if (allColumnsVisible) {
      setAllColumnsVisible(false);
    } else {
      // Keep the checkbox unchecked until the user confirms.
      setConfirmOpen(true);
    }
  }, [allColumnsVisible, setAllColumnsVisible]);

  const handleConfirmYes = useCallback(() => {
    setConfirmOpen(false);
    setAllColumnsVisible(true);
  }, [setAllColumnsVisible]);

  const handleConfirmNo = useCallback(() => {
    setConfirmOpen(false);
  }, []);

  const handleToggleColumn = useCallback(
    (field: string, visible: boolean) => {
      apiRef.current.setColumnVisibility(field, visible);
    },
    [apiRef]
  );

  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  // The columns panel closes on Escape; keep key presses inside the dialog from reaching it.
  const stopKeyPropagation = useCallback((event: KeyboardEvent) => {
    event.stopPropagation();
  }, []);

  const firstRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const lastRow = Math.min(rows.length, Math.ceil((scrollTop + LIST_HEIGHT) / ROW_HEIGHT) + OVERSCAN);
  const windowedRows = rows.slice(firstRow, lastRow);
  const lastColumnIndex = hideableColumns.length - 1;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', width: 360, maxWidth: '100%' }}>
      <Box sx={{ p: 1, pb: 0.5 }}>
        <TextField
          inputRef={searchRef}
          size="small"
          fullWidth
          autoFocus
          variant="outlined"
          placeholder={apiRef.current.getLocaleText('columnsManagementSearchTitle') as string}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setScrollTop(0);
          }}
        />
      </Box>
      <Box
        onScroll={handleScroll}
        sx={{ height: LIST_HEIGHT, overflowY: 'auto', overflowX: 'hidden', px: 0.5 }}
      >
        {rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
            {apiRef.current.getLocaleText('columnsManagementNoColumns')}
          </Typography>
        ) : (
          <Box sx={{ position: 'relative', height: rows.length * ROW_HEIGHT }}>
            {windowedRows.map((row, rowIndex) => (
              <Box
                key={row.field}
                sx={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: (firstRow + rowIndex) * ROW_HEIGHT,
                  height: ROW_HEIGHT,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <FormControlLabel
                  sx={{ flex: 1, minWidth: 0, ml: 0, mr: 0 }}
                  control={
                    <Checkbox
                      size="small"
                      checked={isVisible(columnVisibilityModel, row.field)}
                      onChange={(event) => handleToggleColumn(row.field, event.target.checked)}
                    />
                  }
                  label={row.label}
                  slotProps={{ typography: { variant: 'body2', noWrap: true, title: row.label } }}
                />
                <Tooltip title={t('list.columnsManagement.moveUp')}>
                  <span>
                    <IconButton
                      size="small"
                      disabled={row.index === 0}
                      aria-label={t('list.columnsManagement.moveUp')}
                      onClick={() => moveColumn(row.field, -1)}
                    >
                      <ArrowUpwardIcon fontSize="inherit" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={t('list.columnsManagement.moveDown')}>
                  <span>
                    <IconButton
                      size="small"
                      disabled={row.index === lastColumnIndex}
                      aria-label={t('list.columnsManagement.moveDown')}
                      onClick={() => moveColumn(row.field, 1)}
                    >
                      <ArrowDownwardIcon fontSize="inherit" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
            ))}
          </Box>
        )}
      </Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 0.5,
          pt: 1,
          pr: 1,
          pb: 1,
          pl: 1.5,
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <FormControlLabel
          sx={{ ml: 0, mr: 0 }}
          control={
            <Checkbox
              size="small"
              checked={allColumnsVisible}
              disabled={hideableColumns.length === 0}
              onChange={handleToggleAll}
              name="showHideAll"
            />
          }
          label={apiRef.current.getLocaleText('columnsManagementShowHideAllText')}
          slotProps={{ typography: { variant: 'body2' } }}
        />
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Button size="small" onClick={resetOrder} disabled={isDefaultOrder}>
            {t('list.columnsManagement.resetOrder')}
          </Button>
          <Button size="small" onClick={resetAll} disabled={isDefaultAll}>
            {t('list.columnsManagement.resetAll')}
          </Button>
        </Box>
      </Box>
      <Dialog
        open={confirmOpen}
        onClose={handleConfirmNo}
        onKeyDown={stopKeyPropagation}
        aria-describedby="list-columns-show-all-warning"
      >
        <DialogContent>
          <DialogContentText id="list-columns-show-all-warning">
            {t('list.columnsManagement.showAllWarning')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleConfirmYes} variant="contained">
            {t('list.columnsManagement.yes')}
          </Button>
          <Button onClick={handleConfirmNo} autoFocus>
            {t('list.columnsManagement.no')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
