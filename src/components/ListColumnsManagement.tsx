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

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  FormControlLabel,
} from '@mui/material';
import {
  GridColumnsManagement,
  GridColumnsManagementProps,
  GridColumnVisibilityModel,
  gridColumnDefinitionsSelector,
  gridColumnVisibilityModelSelector,
  useGridApiContext,
  useGridSelector,
} from '@mui/x-data-grid';
import { useTranslation } from 'react-i18next';

interface ListColumnsManagementContextValue {
  /** The visibility model restored by RESET (default columns on, template columns off). */
  defaultColumnVisibilityModel: GridColumnVisibilityModel;
}

export const ListColumnsManagementContext = createContext<ListColumnsManagementContextValue>({
  defaultColumnVisibilityModel: {},
});

const isVisible = (model: GridColumnVisibilityModel, field: string) => model[field] !== false;

/**
 * Replacement for the DataGrid "Manage columns" panel body.
 *
 * It reuses the stock search box and per-column checkboxes (columns are listed in definition
 * order, so the default columns come first and the template columns follow), but replaces the
 * footer so that:
 * - "Show/Hide All" is only checked when every column is visible (never indeterminate), and
 *   checking it asks for confirmation before adding a large number of columns.
 * - "Reset" restores the List view defaults instead of the grid's initial state.
 */
export default function ListColumnsManagement(props: GridColumnsManagementProps) {
  const { t } = useTranslation();
  const apiRef = useGridApiContext();
  const { defaultColumnVisibilityModel } = useContext(ListColumnsManagementContext);
  const columns = useGridSelector(apiRef, gridColumnDefinitionsSelector);
  const columnVisibilityModel = useGridSelector(apiRef, gridColumnVisibilityModelSelector);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const hideableColumns = useMemo(
    () => columns.filter((column) => column.hideable !== false),
    [columns]
  );

  const allColumnsVisible = useMemo(
    () => hideableColumns.length > 0
      && hideableColumns.every((column) => isVisible(columnVisibilityModel, column.field)),
    [columnVisibilityModel, hideableColumns]
  );

  const isDefaultModel = useMemo(
    () => hideableColumns.every((column) =>
      isVisible(columnVisibilityModel, column.field)
        === isVisible(defaultColumnVisibilityModel, column.field)),
    [columnVisibilityModel, defaultColumnVisibilityModel, hideableColumns]
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

  const handleReset = useCallback(() => {
    apiRef.current.setColumnVisibilityModel({ ...defaultColumnVisibilityModel });
  }, [apiRef, defaultColumnVisibilityModel]);

  // The columns panel closes on Escape; keep key presses inside the dialog from reaching it.
  const stopKeyPropagation = useCallback((event: KeyboardEvent) => {
    event.stopPropagation();
  }, []);

  return (
    <>
      <GridColumnsManagement {...props} disableShowHideToggle disableResetButton />
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pt: 1,
          pr: 1,
          pb: 1,
          pl: 1.5,
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <FormControlLabel
          sx={{ ml: 0 }}
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
        <Button size="small" onClick={handleReset} disabled={isDefaultModel}>
          {apiRef.current.getLocaleText('columnsManagementReset')}
        </Button>
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
    </>
  );
}
